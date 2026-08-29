use tauri::{AppHandle, Manager};

pub const MAIN_WINDOW_LABEL: &str = "main";
pub const SPLASH_WINDOW_LABEL: &str = "splash";

/// Reveals the main window and dismisses the splash screen. The order matters:
/// showing `main` first means the desktop never flashes between the two.
#[tauri::command]
pub fn finish_launch(app: AppHandle) {
    if let Some(main) = app.get_webview_window(MAIN_WINDOW_LABEL) {
        let _ = main.show();
        let _ = main.set_focus();
    }

    // `destroy` rather than `close`: the splash is configured as unclosable so
    // the user cannot dismiss it, and it has no unsaved state to guard.
    if let Some(splash) = app.get_webview_window(SPLASH_WINDOW_LABEL) {
        let _ = splash.destroy();
    }
}

/// The frontend owns the unsaved-changes prompt, so it asks to exit here after
/// the user has decided rather than letting the window close itself.
#[tauri::command]
pub fn quit_app(app: AppHandle) {
    app.exit(0);
}
