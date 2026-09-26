use std::sync::atomic::{AtomicBool, Ordering};

use tauri::{window::Color, AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};

pub const MAIN_WINDOW_LABEL: &str = "main";
pub const SPLASH_WINDOW_LABEL: &str = "splash";
/// Keep in sync with ABOUT_WINDOW_LABEL in src/lib/constants.ts
pub const ABOUT_WINDOW_LABEL: &str = "about";

/// Set for a login launch, which must never reveal the splash or the editor.
static BACKGROUND_LAUNCH: AtomicBool = AtomicBool::new(false);
/// Set while the editor is hidden and the menu bar is what remains of the app.
static PARKED: AtomicBool = AtomicBool::new(false);
/// Set before `app.exit`, so a quit from the hidden state is not swallowed.
static QUITTING: AtomicBool = AtomicBool::new(false);

const APP_NAME: &str = "Pixen";
const ABOUT_WINDOW_WIDTH: f64 = 360.0;
const ABOUT_WINDOW_HEIGHT: f64 = 400.0;
/// Matches `--background` in src/styles/globals.css so the window never flashes white.
const ABOUT_WINDOW_BACKGROUND: Color = Color(16, 17, 20, 255);

/// A login launch: accessory from the start, and no splash to dismiss later.
pub fn enter_background(app: &AppHandle) {
    BACKGROUND_LAUNCH.store(true, Ordering::SeqCst);
    PARKED.store(true, Ordering::SeqCst);
    set_accessory(app);

    if let Some(splash) = app.get_webview_window(SPLASH_WINDOW_LABEL) {
        let _ = splash.destroy();
    }
}

/// Brings the editor back. Regular policy restores the Dock icon.
pub fn show_main(app: &AppHandle) {
    PARKED.store(false, Ordering::SeqCst);
    set_regular(app);

    if let Some(main) = app.get_webview_window(MAIN_WINDOW_LABEL) {
        let _ = main.show();
        let _ = main.unminimize();
        let _ = main.set_focus();
    }
}

/// Hides the editor and drops the Dock icon. The webview stays loaded, so
/// unsaved tabs and a later capture still have a session to land in.
pub fn hide_main(app: &AppHandle) {
    // Before the hide, so an exit requested as the last window disappears is
    // still refused.
    PARKED.store(true, Ordering::SeqCst);

    if let Some(about) = app.get_webview_window(ABOUT_WINDOW_LABEL) {
        let _ = about.hide();
    }

    if let Some(main) = app.get_webview_window(MAIN_WINDOW_LABEL) {
        let _ = main.hide();
    }

    set_accessory(app);
}

/// True while the process should ignore an exit that did not come from Quit.
/// A visible editor, including during the splash, still quits normally.
pub fn should_keep_running() -> bool {
    keep_process_alive(
        PARKED.load(Ordering::SeqCst),
        QUITTING.load(Ordering::SeqCst),
    )
}

fn keep_process_alive(parked: bool, quitting: bool) -> bool {
    parked && !quitting
}

/// Reveals the main window and dismisses the splash screen. The order matters:
/// showing `main` first means the desktop never flashes between the two.
/// A background launch only drops the splash, if it is still around.
#[tauri::command]
pub fn finish_launch(app: AppHandle) {
    if BACKGROUND_LAUNCH.load(Ordering::SeqCst) {
        destroy_splash(&app);
        return;
    }

    show_main(&app);
    destroy_splash(&app);
}

/// The frontend owns the unsaved-changes prompt, so it asks to exit here after
/// the user has decided rather than letting the window close itself.
#[tauri::command]
pub fn quit_app(app: AppHandle) {
    QUITTING.store(true, Ordering::SeqCst);
    app.exit(0);
}

fn destroy_splash(app: &AppHandle) {
    // `destroy` rather than `close`: the splash is configured as unclosable so
    // the user cannot dismiss it, and it has no unsaved state to guard.
    if let Some(splash) = app.get_webview_window(SPLASH_WINDOW_LABEL) {
        let _ = splash.destroy();
    }
}

#[cfg(target_os = "macos")]
fn set_regular(app: &AppHandle) {
    let _ = app.set_activation_policy(tauri::ActivationPolicy::Regular);
}

#[cfg(not(target_os = "macos"))]
fn set_regular(_app: &AppHandle) {}

#[cfg(target_os = "macos")]
fn set_accessory(app: &AppHandle) {
    let _ = app.set_activation_policy(tauri::ActivationPolicy::Accessory);
}

#[cfg(not(target_os = "macos"))]
fn set_accessory(_app: &AppHandle) {}

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
    .center()
    .title_bar_style(tauri::TitleBarStyle::Overlay)
    .hidden_title(true);

    let Ok(window) = builder.build() else {
        return;
    };

    let _ = window.set_focus();
}

#[cfg(test)]
mod tests {
    use super::keep_process_alive;

    #[test]
    fn a_parked_app_stays_up_until_quit() {
        assert!(keep_process_alive(true, false));
        assert!(!keep_process_alive(true, true));
        assert!(!keep_process_alive(false, false));
        assert!(!keep_process_alive(false, true));
    }
}
