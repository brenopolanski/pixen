use std::fs;
use std::io::ErrorKind;
use std::path::{Path, PathBuf};

use base64::engine::general_purpose::STANDARD;
use base64::Engine;
use tauri::{AppHandle, Manager};

/// Keep in sync with PROJECT_EXTENSION in src/types/project.ts.
const PROJECT_EXTENSION: &str = "pix";
const RECOVERY_FILE_NAME: &str = "recovery.json";
/// Reading a file this large would allocate several times its size once it is
/// base64-encoded and copied into the webview, so it is refused up front.
const MAX_IMAGE_BYTES: u64 = 64 * 1024 * 1024;
/// A project embeds two base64 images, so its ceiling is higher than an image's.
const MAX_PROJECT_BYTES: u64 = 256 * 1024 * 1024;

const IMAGE_SUBJECT: &str = "this image";
const PROJECT_SUBJECT: &str = "this project";
const RECOVERY_SUBJECT: &str = "the recovery file";

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

fn ensure_project_extension(path: &Path) -> Result<(), String> {
    if extension_of(path) == PROJECT_EXTENSION {
        return Ok(());
    }

    Err(format!("Pixen projects use the .{PROJECT_EXTENSION} extension."))
}

fn read_text(path: &Path, subject: &str) -> Result<String, String> {
    let bytes = fs::read(path).map_err(|error| io_error_message(&error, "read", subject))?;

    String::from_utf8(bytes).map_err(|_| format!("Could not read {subject}: the file is damaged."))
}

/// Writes through a sibling temp file so an interrupted save cannot leave a
/// half-written file where a readable one used to be.
fn write_atomically(path: &Path, contents: &str, subject: &str) -> Result<(), String> {
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

fn recovery_path(app: &AppHandle) -> Result<PathBuf, String> {
    let directory = app
        .path()
        .app_data_dir()
        .map_err(|_| "Could not locate the Pixen data folder.".to_string())?;

    Ok(directory.join(RECOVERY_FILE_NAME))
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

#[tauri::command]
pub fn read_project(path: String) -> Result<String, String> {
    let path = PathBuf::from(path);

    ensure_project_extension(&path)?;
    ensure_size_limit(&path, MAX_PROJECT_BYTES, PROJECT_SUBJECT)?;

    read_text(&path, PROJECT_SUBJECT)
}

#[tauri::command]
pub fn write_project(path: String, contents: String) -> Result<(), String> {
    let path = PathBuf::from(path);

    ensure_project_extension(&path)?;
    write_atomically(&path, &contents, PROJECT_SUBJECT)
}

/// Recovery snapshots live in the app data folder so they never sit next to —
/// or overwrite — the files the user chose.
#[tauri::command]
pub fn read_recovery(app: AppHandle) -> Result<Option<String>, String> {
    let path = recovery_path(&app)?;

    if !path.exists() {
        return Ok(None);
    }

    read_text(&path, RECOVERY_SUBJECT).map(Some)
}

#[tauri::command]
pub fn write_recovery(app: AppHandle, contents: String) -> Result<(), String> {
    let path = recovery_path(&app)?;

    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|error| io_error_message(&error, "create", "the Pixen data folder"))?;
    }

    write_atomically(&path, &contents, RECOVERY_SUBJECT)
}

#[tauri::command]
pub fn clear_recovery(app: AppHandle) -> Result<(), String> {
    let path = recovery_path(&app)?;

    match fs::remove_file(&path) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == ErrorKind::NotFound => Ok(()),
        Err(error) => Err(io_error_message(&error, "remove", RECOVERY_SUBJECT)),
    }
}
