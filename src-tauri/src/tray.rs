use tauri::{
    image::Image,
    menu::{CheckMenuItem, Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager,
};
use tauri_plugin_autostart::ManagerExt;

use crate::window::{show_about_window, MAIN_WINDOW_LABEL};

const APP_NAME: &str = "Pixen";

/// What macOS takes a screenshot with everywhere else, and what Lightshot
/// binds too. Registered system-wide so it fires while another app is in
/// front, which is the whole point of the tray.
pub const CAPTURE_SHORTCUT: &str = "CommandOrControl+Shift+9";

/// Keep in sync with CAPTURE_REQUESTED_EVENT in src/lib/constants.ts
const CAPTURE_REQUESTED_EVENT: &str = "pixen-capture-requested";
/// Keep in sync with QUIT_REQUESTED_EVENT in src/lib/constants.ts
const QUIT_REQUESTED_EVENT: &str = "pixen-quit-requested";

/// Builds the menu bar item. Pixen keeps its Dock icon and editor window, so
/// this is a second way in rather than the whole app: the activation policy is
/// left alone.
///
/// Left-click captures, like Lightshot. The menu is the right-click, which is
/// what `show_menu_on_left_click(false)` buys.
pub fn setup_tray(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    // Release builds opt in once so a fresh install starts at login. Dev builds
    // skip it so `tauri dev` does not register the debug binary.
    #[cfg(not(debug_assertions))]
    enable_autostart_on_first_launch(app);

    let capture_item = MenuItem::with_id(
        app,
        "capture",
        "Take Screenshot",
        true,
        Some(CAPTURE_SHORTCUT),
    )?;
    let launch_at_login_item = CheckMenuItem::with_id(
        app,
        "launch-at-login",
        "Start at Login",
        true,
        app.autolaunch().is_enabled().unwrap_or(false),
        None::<&str>,
    )?;
    let about_item = MenuItem::with_id(
        app,
        "about",
        format!("About {APP_NAME}"),
        true,
        None::<&str>,
    )?;
    let quit_item =
        MenuItem::with_id(app, "quit", format!("Quit {APP_NAME}"), true, Some("cmd+q"))?;
    let top_separator = PredefinedMenuItem::separator(app)?;
    let bottom_separator = PredefinedMenuItem::separator(app)?;
    let menu = Menu::with_items(
        app,
        &[
            &capture_item,
            &top_separator,
            &launch_at_login_item,
            &bottom_separator,
            &about_item,
            &quit_item,
        ],
    )?;

    let icon = Image::from_bytes(include_bytes!("../icons/tray-icon.png"))?;

    TrayIconBuilder::with_id("main")
        .icon(icon)
        .icon_as_template(true)
        .tooltip(APP_NAME)
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(move |app, event| match event.id.as_ref() {
            "capture" => request_capture(app),
            "launch-at-login" => toggle_launch_at_login(app, &launch_at_login_item),
            "about" => show_about_window(app.clone()),
            "quit" => request_quit(app),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                request_capture(tray.app_handle());
            }
        })
        .build(app)?;

    Ok(())
}

/// Hands the capture to the session rather than running it here: the shot still
/// has to land in a tab, which means going through the replace-if-clean rules
/// and the prompt for an overlay with unapplied marks.
pub fn request_capture(app: &AppHandle) {
    emit_to_main(app, CAPTURE_REQUESTED_EVENT);
}

/// Quit goes through the frontend for the same reason the native menu's does:
/// `app.exit` would drop unsaved edits without asking.
fn request_quit(app: &AppHandle) {
    if !emit_to_main(app, QUIT_REQUESTED_EVENT) {
        app.exit(0);
    }
}

/// Reports whether the main window was there to hear it.
fn emit_to_main(app: &AppHandle, event: &str) -> bool {
    let Some(window) = app.get_webview_window(MAIN_WINDOW_LABEL) else {
        return false;
    };

    window.emit(event, ()).is_ok()
}

fn toggle_launch_at_login(app: &AppHandle, item: &CheckMenuItem<tauri::Wry>) {
    let autostart = app.autolaunch();
    let currently_enabled = autostart.is_enabled().unwrap_or(false);
    let changed = if currently_enabled {
        autostart.disable().is_ok()
    } else {
        autostart.enable().is_ok()
    };
    // The checkmark follows what the system actually reports, so a refused
    // toggle leaves the menu telling the truth.
    let enabled = if changed {
        !currently_enabled
    } else {
        autostart.is_enabled().unwrap_or(currently_enabled)
    };

    let _ = item.set_checked(enabled);
}

/// Registers login launch the first time a packaged build runs. A marker file
/// keeps later launches from turning it back on after the user unchecks it.
#[cfg(not(debug_assertions))]
fn enable_autostart_on_first_launch(app: &AppHandle) {
    let Ok(config_dir) = app.path().app_config_dir() else {
        return;
    };
    let marker = config_dir.join("autostart-initialized");

    if marker.exists() {
        return;
    }

    let _ = std::fs::create_dir_all(&config_dir);

    if app.autolaunch().enable().is_ok() {
        let _ = std::fs::write(marker, []);
    }
}
