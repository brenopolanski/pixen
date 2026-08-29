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

    #[test]
    fn rejects_anything_that_is_not_a_base64_data_url() {
        assert!(decode_data_url("https://example.com/photo.png").is_err());
        assert!(decode_data_url("data:image/png,unencoded").is_err());
        assert!(decode_data_url("data:image/png;base64,not base64").is_err());
    }
}
