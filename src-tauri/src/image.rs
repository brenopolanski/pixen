use std::fs;
use std::io::ErrorKind;
use std::path::{Path, PathBuf};

use base64::engine::general_purpose::STANDARD;
use base64::Engine;

/// Reading a file this large would allocate several times its size once it is
/// base64-encoded and copied into the webview, so it is refused up front.
const MAX_IMAGE_BYTES: u64 = 64 * 1024 * 1024;

const IMAGE_SUBJECT: &str = "this image";

/// Keep in sync with IMAGE_EXTENSIONS in src/lib/constants.ts.
fn image_mime_type(extension: &str) -> Option<&'static str> {
    match extension {
        "png" => Some("image/png"),
        "jpg" | "jpeg" => Some("image/jpeg"),
        "webp" => Some("image/webp"),
        _ => None,
    }
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
    let metadata =
        fs::metadata(path).map_err(|error| io_error_message(&error, "read", subject))?;

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
        return Err(format!("Could not write {subject}: the path is not a file."));
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

/// Reads a user-picked image and returns it as a data URL, which is the only
/// image form the editor accepts.
#[tauri::command]
pub fn read_image(path: String) -> Result<String, String> {
    let path = PathBuf::from(path);

    let Some(mime_type) = image_mime_type(&extension_of(&path)) else {
        return Err("Pixen can open PNG, JPEG and WebP images.".to_string());
    };

    ensure_size_limit(&path, MAX_IMAGE_BYTES, IMAGE_SUBJECT)?;

    let bytes = fs::read(&path).map_err(|error| io_error_message(&error, "read", IMAGE_SUBJECT))?;

    Ok(format!("data:{mime_type};base64,{}", STANDARD.encode(bytes)))
}

/// Writes an edited image. The data URL's own media type has to match the
/// destination's extension, so the bytes on disk always agree with the name the
/// user chose in the save dialog.
#[tauri::command]
pub fn write_image(path: String, data_url: String) -> Result<(), String> {
    let path = PathBuf::from(path);

    let Some(mime_type) = image_mime_type(&extension_of(&path)) else {
        return Err("Pixen can save PNG, JPEG and WebP images.".to_string());
    };

    let expected_prefix = format!("data:{mime_type};base64,");

    let Some(payload) = data_url.strip_prefix(&expected_prefix) else {
        return Err(format!("Could not save {IMAGE_SUBJECT} as a {mime_type} file."));
    };

    let bytes = STANDARD
        .decode(payload)
        .map_err(|_| format!("Could not write {IMAGE_SUBJECT}: the data is damaged."))?;

    write_atomically(&path, &bytes, IMAGE_SUBJECT)
}
