mod capture;
mod clipboard;
mod dialog;
mod image;
mod login;
mod shortcut;
mod tray;
mod window;

use std::thread;
use std::time::Duration;

use tauri::Manager;
use tauri_plugin_global_shortcut::{Builder as ShortcutBuilder, ShortcutState};

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
        // No shortcut is bound here: the combo is whatever the user last
        // chose, so `shortcut::init` registers it once the app can read it.
        // The handler covers every registration, including a later rebind.
        .plugin(
            ShortcutBuilder::default()
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
            shortcut::get_capture_shortcut,
            shortcut::restore_capture_shortcut,
            shortcut::set_capture_shortcut,
            shortcut::suspend_capture_shortcut,
            window::finish_launch,
            window::quit_app,
            window::show_about_window,
        ])
        .setup(|app| {
            // The splash is created hidden. A login launch never shows it;
            // a normal launch does, before the editor is ready.
            if login::launched_as_login_item() {
                window::enter_background(app.handle());
            } else if let Some(splash) = app.get_webview_window(window::SPLASH_WINDOW_LABEL) {
                let _ = splash.show();
            }

            let handle = app.handle().clone();

            thread::spawn(move || {
                thread::sleep(LAUNCH_TIMEOUT);
                window::finish_launch(handle);
            });

            // Before the tray, which labels its capture item with whatever
            // this registers.
            shortcut::init(app.handle());
            tray::setup_tray(app.handle())?;

            Ok(())
        })
        .on_window_event(|window, event| {
            if window.label() != window::MAIN_WINDOW_LABEL {
                return;
            }

            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                window::hide_main(window.app_handle());
            }
        })
        .build(tauri::generate_context!())
        .expect("error while building Pixen")
        .run(|app, event| match event {
            tauri::RunEvent::ExitRequested { api, .. } => {
                if window::should_keep_running() {
                    api.prevent_exit();
                }
            }
            #[cfg(target_os = "macos")]
            tauri::RunEvent::Reopen {
                has_visible_windows,
                ..
            } => {
                // Finder or the Dock relaunching an already-running app. A
                // click while the editor is already up should not steal focus.
                if !has_visible_windows {
                    window::show_main(app);
                }
            }
            _ => {}
        });
}
