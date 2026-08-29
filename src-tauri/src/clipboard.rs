use tauri::image::Image;
use tauri::AppHandle;
use tauri_plugin_clipboard_manager::ClipboardExt;

use crate::image::rgba_from_data_url;

/// Puts the edited image on the system clipboard.
///
/// The clipboard takes raw pixels rather than an encoded file, so the toolbar's
/// save format has no bearing here: whichever app receives the paste decides
/// how to store it.
///
/// `async` because decoding a large canvas into RGBA is real work, and because
/// the clipboard libraries can deadlock on Linux when driven from the main
/// thread.
#[tauri::command]
pub async fn copy_image(app: AppHandle, data_url: String) -> Result<(), String> {
    let (rgba, width, height) = rgba_from_data_url(&data_url)?;

    app.clipboard()
        .write_image(&Image::new_owned(rgba, width, height))
        .map_err(|_| "Pixen could not copy this image to the clipboard.".to_string())
}
