use std::fs;
use std::io::{Cursor, ErrorKind};
use std::path::{Path, PathBuf};

use base64::engine::general_purpose::STANDARD;
use base64::Engine;
use image::codecs::jpeg::JpegEncoder;
use image::codecs::webp::WebPEncoder;
use image::{DynamicImage, ExtendedColorType, ImageEncoder, Rgb, RgbImage};

/// Reading a file this large would allocate several times its size once it is
/// base64-encoded and copied into the webview, so it is refused up front.
const MAX_IMAGE_BYTES: u64 = 64 * 1024 * 1024;

const IMAGE_SUBJECT: &str = "this image";

/// Matches the quality the editor itself uses for lossy exports.
const JPEG_QUALITY: u8 = 92;

/// Mosaic block size. Coarse enough that small text cannot be read back out of
/// the averages, which is the whole point of censoring a region.
const PIXELIZE_BLOCK: u32 = 12;

/// The formats Pixen can open and save.
///
/// Encoding lives here rather than in a canvas because WebKit has never
/// implemented `toDataURL('image/webp')` — it silently hands back PNG — which
/// left WebP working on Windows and nowhere else.
///
/// Keep in sync with IMAGE_EXTENSIONS in src/lib/constants.ts and SAVE_FORMATS
/// in src/lib/image/image.ts.
#[derive(Clone, Copy, PartialEq, Eq)]
pub enum Format {
    Png,
    Jpeg,
    WebP,
}

impl Format {
    fn from_extension(extension: &str) -> Option<Self> {
        match extension {
            "png" => Some(Self::Png),
            "jpg" | "jpeg" => Some(Self::Jpeg),
            "webp" => Some(Self::WebP),
            _ => None,
        }
    }

    fn mime_type(self) -> &'static str {
        match self {
            Self::Png => "image/png",
            Self::Jpeg => "image/jpeg",
            Self::WebP => "image/webp",
        }
    }

    fn image_format(self) -> image::ImageFormat {
        match self {
            Self::Png => image::ImageFormat::Png,
            Self::Jpeg => image::ImageFormat::Jpeg,
            Self::WebP => image::ImageFormat::WebP,
        }
    }
}

/// Composites onto white, because JPEG carries no alpha channel and anything
/// transparent would otherwise encode black.
fn flatten_onto_white(image: &DynamicImage) -> RgbImage {
    if !image.color().has_alpha() {
        return image.to_rgb8();
    }

    let source = image.to_rgba8();
    let mut flattened = RgbImage::new(source.width(), source.height());

    for (x, y, pixel) in source.enumerate_pixels() {
        let [red, green, blue, alpha] = pixel.0;
        let opacity = f32::from(alpha) / 255.0;
        let over_white =
            |channel: u8| (f32::from(channel) * opacity + 255.0 * (1.0 - opacity)).round() as u8;

        flattened.put_pixel(
            x,
            y,
            Rgb([over_white(red), over_white(green), over_white(blue)]),
        );
    }

    flattened
}

fn decode(bytes: &[u8]) -> Result<DynamicImage, String> {
    image::load_from_memory(bytes).map_err(|_| "Pixen could not read the edited image.".to_string())
}

fn encode(bytes: &[u8], format: Format) -> Result<Vec<u8>, String> {
    let source = decode(bytes)?;
    let mut encoded = Vec::new();

    let result = match format {
        Format::Png => source.write_to(&mut Cursor::new(&mut encoded), image::ImageFormat::Png),
        Format::Jpeg => {
            let flattened = flatten_onto_white(&source);

            JpegEncoder::new_with_quality(&mut encoded, JPEG_QUALITY).encode_image(&flattened)
        }
        Format::WebP => {
            let rgba = source.to_rgba8();

            WebPEncoder::new_lossless(&mut encoded).write_image(
                rgba.as_raw(),
                rgba.width(),
                rgba.height(),
                ExtendedColorType::Rgba8,
            )
        }
    };

    result.map_err(|_| {
        format!(
            "Could not save {IMAGE_SUBJECT} as a {} file.",
            format.mime_type()
        )
    })?;

    Ok(encoded)
}

/// The payload of `data:<media type>;base64,<payload>`. The declared media type
/// is ignored: what the bytes actually are is decided by sniffing them.
fn decode_data_url(data_url: &str) -> Result<Vec<u8>, String> {
    let payload = data_url
        .strip_prefix("data:")
        .and_then(|rest| rest.split_once(";base64,"))
        .map(|(_, payload)| payload)
        .ok_or_else(|| format!("Could not read {IMAGE_SUBJECT}: the data is not an image."))?;

    STANDARD
        .decode(payload)
        .map_err(|_| format!("Could not read {IMAGE_SUBJECT}: the data is damaged."))
}

/// The editor's output as raw RGBA and its dimensions, which is the form the
/// system clipboard takes — it carries pixels, not an encoded file.
pub fn rgba_from_data_url(data_url: &str) -> Result<(Vec<u8>, u32, u32), String> {
    let rgba = decode(&decode_data_url(data_url)?)?.to_rgba8();
    let (width, height) = rgba.dimensions();

    Ok((rgba.into_raw(), width, height))
}

/// The part of a requested region that actually lies on the image, or None when
/// none of it does. The overlay clamps too, but it measures a preview that the
/// canvas may have moved on from, so the bounds are enforced here as well.
fn clamp_region(
    image: &DynamicImage,
    x: u32,
    y: u32,
    width: u32,
    height: u32,
) -> Option<(u32, u32, u32, u32)> {
    let (image_width, image_height) = (image.width(), image.height());

    if x >= image_width || y >= image_height {
        return None;
    }

    let width = width.min(image_width - x);
    let height = height.min(image_height - y);

    if width == 0 || height == 0 {
        return None;
    }

    Some((x, y, width, height))
}

/// Averages each block of the region into a single colour.
///
/// Alpha is averaged with the colour channels rather than dropped, so a mosaic
/// over a transparent PNG stays transparent instead of growing a grey square.
/// Blocks are clipped to the region, so nothing outside the drag is touched.
fn mosaic(image: &DynamicImage, region: (u32, u32, u32, u32)) -> DynamicImage {
    let (left, top, width, height) = region;
    let mut canvas = image.to_rgba8();

    for block_y in (top..top + height).step_by(PIXELIZE_BLOCK as usize) {
        let block_height = PIXELIZE_BLOCK.min(top + height - block_y);

        for block_x in (left..left + width).step_by(PIXELIZE_BLOCK as usize) {
            let block_width = PIXELIZE_BLOCK.min(left + width - block_x);

            // u64 because a block is up to 144 pixels of 255 per channel, and
            // the running total should not depend on the block size chosen.
            let mut totals = [0u64; 4];

            for y in block_y..block_y + block_height {
                for x in block_x..block_x + block_width {
                    let pixel = canvas.get_pixel(x, y).0;

                    for (total, channel) in totals.iter_mut().zip(pixel) {
                        *total += u64::from(channel);
                    }
                }
            }

            let count = u64::from(block_width) * u64::from(block_height);
            let mut average = [0u8; 4];

            for (channel, total) in average.iter_mut().zip(totals) {
                *channel = (total / count) as u8;
            }

            for y in block_y..block_y + block_height {
                for x in block_x..block_x + block_width {
                    canvas.put_pixel(x, y, image::Rgba(average));
                }
            }
        }
    }

    DynamicImage::ImageRgba8(canvas)
}

/// Hides a region behind a mosaic and hands the whole image back.
///
/// PNG both ways: this is an edit on its way back to the editor rather than
/// something being saved, so the toolbar's chosen format has no say in it, and
/// PNG is the one format here that always keeps alpha.
#[tauri::command]
pub fn pixelize_image(
    data_url: String,
    x: u32,
    y: u32,
    width: u32,
    height: u32,
) -> Result<String, String> {
    let source = decode(&decode_data_url(&data_url)?)?;

    let Some(region) = clamp_region(&source, x, y, width, height) else {
        return Err(format!("That selection is outside {IMAGE_SUBJECT}."));
    };

    let mut encoded = Vec::new();

    mosaic(&source, region)
        .write_to(&mut Cursor::new(&mut encoded), image::ImageFormat::Png)
        .map_err(|_| format!("Could not hide that part of {IMAGE_SUBJECT}."))?;

    Ok(format!(
        "data:{};base64,{}",
        Format::Png.mime_type(),
        STANDARD.encode(encoded)
    ))
}

fn extension_of(path: &Path) -> String {
    path.extension()
        .and_then(|extension| extension.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase()
}

/// Maps an OS error onto a short sentence the UI can show as-is. The original
/// error never reaches the frontend.
fn io_error_message(error: &std::io::Error, verb: &str, subject: &str) -> String {
    match error.kind() {
        ErrorKind::NotFound => format!("Could not find {subject}."),
        ErrorKind::PermissionDenied => {
            format!("Pixen does not have permission to {verb} {subject}.")
        }
        _ => format!("Could not {verb} {subject}."),
    }
}

fn ensure_size_limit(path: &Path, limit: u64, subject: &str) -> Result<(), String> {
    let metadata = fs::metadata(path).map_err(|error| io_error_message(&error, "read", subject))?;

    if metadata.len() > limit {
        return Err(format!(
            "This file is too large to open ({} MB maximum).",
            limit / (1024 * 1024)
        ));
    }

    Ok(())
}

/// Writes through a sibling temp file so an interrupted save cannot leave a
/// half-written file where a readable one used to be.
fn write_atomically(path: &Path, contents: &[u8], subject: &str) -> Result<(), String> {
    let Some(file_name) = path.file_name() else {
        return Err(format!(
            "Could not write {subject}: the path is not a file."
        ));
    };

    let mut temp_name = file_name.to_os_string();
    temp_name.push(".tmp");
    let temp_path = path.with_file_name(temp_name);

    fs::write(&temp_path, contents).map_err(|error| io_error_message(&error, "write", subject))?;

    if let Err(error) = fs::rename(&temp_path, path) {
        let _ = fs::remove_file(&temp_path);
        return Err(io_error_message(&error, "write", subject));
    }

    Ok(())
}

/// Reads an image file of a known format as a data URL, which is the only image
/// form the editor accepts. Shared with the screenshot capture, which knows its
/// own output is PNG and so has no extension to inspect.
pub fn read_as_data_url(path: &Path, format: Format) -> Result<String, String> {
    ensure_size_limit(path, MAX_IMAGE_BYTES, IMAGE_SUBJECT)?;

    let bytes = fs::read(path).map_err(|error| io_error_message(&error, "read", IMAGE_SUBJECT))?;

    Ok(format!(
        "data:{};base64,{}",
        format.mime_type(),
        STANDARD.encode(bytes)
    ))
}

/// Reads a user-picked image, refusing anything Pixen cannot decode.
#[tauri::command]
pub fn read_image(path: String) -> Result<String, String> {
    let path = PathBuf::from(path);

    let Some(format) = Format::from_extension(&extension_of(&path)) else {
        return Err("Pixen can open PNG, JPEG and WebP images.".to_string());
    };

    read_as_data_url(&path, format)
}

/// Writes an edited image, encoded into whichever format the destination's
/// extension names, so the bytes on disk always agree with the name the user
/// chose in the save dialog.
#[tauri::command]
pub fn write_image(path: String, data_url: String) -> Result<(), String> {
    let path = PathBuf::from(path);

    let Some(format) = Format::from_extension(&extension_of(&path)) else {
        return Err("Pixen can save PNG, JPEG and WebP images.".to_string());
    };

    let bytes = decode_data_url(&data_url)?;

    // The editor returns the image it was given whenever the canvas holds no
    // objects, so an untouched JPEG saved as a JPEG is written through as-is
    // rather than put through a second round of lossy compression.
    let contents = match image::guess_format(&bytes) {
        Ok(actual) if actual == format.image_format() => bytes,
        _ => encode(&bytes, format)?,
    };

    write_atomically(&path, &contents, IMAGE_SUBJECT)
}

#[cfg(test)]
mod tests {
    use image::{Rgba, RgbaImage};

    use super::*;

    /// Fully transparent, so a dropped alpha channel is visible in the output.
    fn transparent_png() -> Vec<u8> {
        let source = RgbaImage::from_pixel(32, 32, Rgba([0, 0, 0, 0]));
        let mut bytes = Vec::new();

        DynamicImage::ImageRgba8(source)
            .write_to(&mut Cursor::new(&mut bytes), image::ImageFormat::Png)
            .expect("the fixture encodes");

        bytes
    }

    /// The bug this guards: WebKit answers a request for WebP with PNG, so an
    /// encoder has to be checked against what it actually produced.
    #[test]
    fn encodes_every_format_as_itself() {
        for (format, expected) in [
            (Format::Png, image::ImageFormat::Png),
            (Format::Jpeg, image::ImageFormat::Jpeg),
            (Format::WebP, image::ImageFormat::WebP),
        ] {
            let encoded = encode(&transparent_png(), format).expect("the image encodes");

            assert_eq!(image::guess_format(&encoded).ok(), Some(expected));
        }
    }

    #[test]
    fn flattens_transparency_onto_white_for_jpeg() {
        let encoded = encode(&transparent_png(), Format::Jpeg).expect("the image encodes");
        let decoded = image::load_from_memory(&encoded)
            .expect("the jpeg decodes")
            .to_rgb8();

        // White, not the black that simply dropping alpha would leave behind.
        assert!(decoded
            .pixels()
            .all(|pixel| pixel.0.iter().all(|&channel| channel > 250)));
    }

    #[test]
    fn keeps_transparency_for_webp() {
        let encoded = encode(&transparent_png(), Format::WebP).expect("the image encodes");
        let decoded = image::load_from_memory(&encoded)
            .expect("the webp decodes")
            .to_rgba8();

        assert!(decoded.pixels().all(|pixel| pixel.0[3] == 0));
    }

    #[test]
    fn reads_data_urls_as_rgba_without_losing_alpha() {
        let data_url = format!(
            "data:image/png;base64,{}",
            STANDARD.encode(transparent_png())
        );
        let (rgba, width, height) = rgba_from_data_url(&data_url).expect("the data url decodes");

        assert_eq!((width, height), (32, 32));
        assert_eq!(rgba.len() as u32, width * height * 4);
        // Every fourth byte is an alpha channel.
        assert!(rgba.iter().skip(3).step_by(4).all(|&alpha| alpha == 0));
    }

    /// Black on the left half, white on the right, so an averaged block is
    /// obvious and an untouched pixel is too.
    fn split_png(width: u32, height: u32) -> Vec<u8> {
        let mut source = RgbaImage::new(width, height);

        for (x, _, pixel) in source.enumerate_pixels_mut() {
            let shade = if x < width / 2 { 0 } else { 255 };
            *pixel = Rgba([shade, shade, shade, 255]);
        }

        let mut bytes = Vec::new();

        DynamicImage::ImageRgba8(source)
            .write_to(&mut Cursor::new(&mut bytes), image::ImageFormat::Png)
            .expect("the fixture encodes");

        bytes
    }

    fn as_data_url(bytes: Vec<u8>) -> String {
        format!("data:image/png;base64,{}", STANDARD.encode(bytes))
    }

    fn pixelized(data_url: &str, x: u32, y: u32, width: u32, height: u32) -> RgbaImage {
        let result = pixelize_image(data_url.to_string(), x, y, width, height)
            .expect("the region pixelizes");
        let bytes = decode_data_url(&result).expect("the result is a data url");

        image::load_from_memory(&bytes)
            .expect("the result decodes")
            .to_rgba8()
    }

    #[test]
    fn averages_the_region_and_leaves_the_rest_alone() {
        // 8x8 is smaller than one 12px block, so the 4x4 region collapses to a
        // single colour: half black, half white averages to mid grey.
        let image = pixelized(&as_data_url(split_png(8, 8)), 2, 2, 4, 4);

        for y in 2..6 {
            for x in 2..6 {
                assert_eq!(image.get_pixel(x, y).0, [127, 127, 127, 255]);
            }
        }

        // Just outside the region on every side, the original split survives.
        assert_eq!(image.get_pixel(1, 1).0, [0, 0, 0, 255]);
        assert_eq!(image.get_pixel(6, 6).0, [255, 255, 255, 255]);
        assert_eq!(image.get_pixel(2, 1).0, [0, 0, 0, 255]);
        assert_eq!(image.get_pixel(5, 6).0, [255, 255, 255, 255]);
    }

    #[test]
    fn keeps_alpha_while_hiding_a_region() {
        let image = pixelized(&as_data_url(transparent_png()), 0, 0, 32, 32);

        assert!(image.pixels().all(|pixel| pixel.0[3] == 0));
    }

    #[test]
    fn clamps_a_region_that_hangs_off_the_edge() {
        // Asking for 40px of an 8px image is not an error: the overlay may be
        // measuring a preview the canvas has since moved on from.
        let image = pixelized(&as_data_url(split_png(8, 8)), 6, 6, 40, 40);

        assert_eq!(image.dimensions(), (8, 8));
        assert_eq!(image.get_pixel(7, 7).0, [255, 255, 255, 255]);
    }

    #[test]
    fn refuses_a_region_that_starts_past_the_edge() {
        assert!(pixelize_image(as_data_url(split_png(8, 8)), 8, 0, 4, 4).is_err());
        assert!(pixelize_image(as_data_url(split_png(8, 8)), 0, 0, 0, 4).is_err());
    }

    #[test]
    fn rejects_anything_that_is_not_a_base64_data_url() {
        assert!(decode_data_url("https://example.com/photo.png").is_err());
        assert!(decode_data_url("data:image/png,unencoded").is_err());
        assert!(decode_data_url("data:image/png;base64,not base64").is_err());
    }
}
