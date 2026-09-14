mod capture;
mod clipboard;
mod dialog;
mod image;
mod tray;
mod window;

use std::thread;
use std::time::Duration;

use tauri_plugin_global_shortcut::{Builder as ShortcutBuilder, ShortcutState};

use crate::tray::CAPTURE_SHORTCUT;

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
        .plugin(
            tauri_plugin_autostart::Builder::new()
                .app_name("Pixen")
                .build(),
        )
        .plugin(
            ShortcutBuilder::default()
                .with_shortcut(CAPTURE_SHORTCUT)
                .expect("invalid capture shortcut")
                .with_handler(|app, _shortcut, event| {
                    if event.state == ShortcutState::Pressed {
                        tray::request_capture(app);
                    }
                })
                .build(),
        )
        .invoke_handler(tauri::generate_handler![
            capture::capture_screen,
            clipboard::copy_image,
            dialog::confirm_apply_overlay,
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

            tray::setup_tray(app.handle())?;

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Pixen");
}
