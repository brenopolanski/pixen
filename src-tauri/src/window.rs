use tauri::{window::Color, AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};

pub const MAIN_WINDOW_LABEL: &str = "main";
pub const SPLASH_WINDOW_LABEL: &str = "splash";
/// Keep in sync with ABOUT_WINDOW_LABEL in src/lib/constants.ts
pub const ABOUT_WINDOW_LABEL: &str = "about";

const APP_NAME: &str = "Pixen";
const ABOUT_WINDOW_WIDTH: f64 = 360.0;
const ABOUT_WINDOW_HEIGHT: f64 = 400.0;
/// Matches `--background` in src/index.css so the window never flashes white.
const ABOUT_WINDOW_BACKGROUND: Color = Color(16, 17, 20, 255);

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

/// Opens About, or focuses it if it is already open. Built on demand rather
/// than at launch, so it does not sit next to splash and main from the start.
#[tauri::command]
pub fn show_about_window(app: AppHandle) {
    if let Some(window) = app.get_webview_window(ABOUT_WINDOW_LABEL) {
        let _ = window.show();
        let _ = window.set_focus();
        return;
    }

    let builder = WebviewWindowBuilder::new(
        &app,
        ABOUT_WINDOW_LABEL,
        WebviewUrl::App(format!("index.html?window={ABOUT_WINDOW_LABEL}").into()),
    )
    .title(format!("About {APP_NAME}"))
    .inner_size(ABOUT_WINDOW_WIDTH, ABOUT_WINDOW_HEIGHT)
    .background_color(ABOUT_WINDOW_BACKGROUND)
    .resizable(false)
    .maximizable(false)
    .minimizable(false)
    .center();

    #[cfg(target_os = "macos")]
    let builder = builder
        .title_bar_style(tauri::TitleBarStyle::Overlay)
        .hidden_title(true);

    let Ok(window) = builder.build() else {
        return;
    };

    let _ = window.set_focus();
}
