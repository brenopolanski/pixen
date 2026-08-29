mod capture;
mod clipboard;
mod dialog;
mod image;
mod window;

use std::thread;
use std::time::Duration;

/// If the frontend never reports that it is ready — a bundle that failed to
/// evaluate, for instance — the splash screen is dismissed anyway so the user
/// is never stranded on it.
const LAUNCH_TIMEOUT: Duration = Duration::from_secs(12);

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        // Registered for its Rust API only: the clipboard is written from
        // `copy_image`, never from the webview, so no permission is granted.
        .plugin(tauri_plugin_clipboard_manager::init())
        .invoke_handler(tauri::generate_handler![
            capture::capture_screen,
            clipboard::copy_image,
            dialog::confirm_unsaved_changes,
            image::pixelize_image,
            image::read_image,
            image::write_image,
            window::finish_launch,
            window::quit_app,
            window::show_about_window,
        ])
        .setup(|app| {
            let handle = app.handle().clone();

            thread::spawn(move || {
                thread::sleep(LAUNCH_TIMEOUT);
                window::finish_launch(handle);
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Pixen");
}
