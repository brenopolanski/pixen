use tauri::{
    image::Image,
    menu::{CheckMenuItem, Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager,
};
#[cfg(not(debug_assertions))]
use tauri_plugin_autostart::ManagerExt;

use crate::login;
use crate::shortcut::CaptureShortcut;
use crate::window::{self, show_about_window, MAIN_WINDOW_LABEL};

const APP_NAME: &str = "Pixen";

/// Keep in sync with CAPTURE_REQUESTED_EVENT in src/lib/constants.ts
const CAPTURE_REQUESTED_EVENT: &str = "pixen-capture-requested";
/// Keep in sync with QUIT_REQUESTED_EVENT in src/lib/constants.ts
const QUIT_REQUESTED_EVENT: &str = "pixen-quit-requested";

/// Builds the menu bar item. Closing the editor hides it and leaves this
/// running; only Quit exits the process.
///
/// Left-click captures, like Lightshot. The menu is the right-click, which is
/// what `show_menu_on_left_click(false)` buys.
pub fn setup_tray(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    // Start at Login stays off until the user checks it. This only moves a
    // LaunchAgent that an older build already turned on.
    #[cfg(not(debug_assertions))]
    migrate_legacy_launch_agent(app);

    // Whatever the recorder last stored, so the menu is not left advertising
    // a combo that no longer fires.
    let open_item = MenuItem::with_id(app, "open", format!("Open {APP_NAME}"), true, None::<&str>)?;
    let capture_item = MenuItem::with_id(
        app,
        "capture",
        "Take Screenshot",
        true,
        Some(app.state::<CaptureShortcut>().accelerator()),
    )?;
    let launch_at_login_item = CheckMenuItem::with_id(
        app,
        "launch-at-login",
        "Start at Login",
        true,
        login::is_enabled(),
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
            &open_item,
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
            "open" => window::show_main(app),
            "capture" => request_capture(app),
            "launch-at-login" => toggle_launch_at_login(&launch_at_login_item),
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

    crate::shortcut::attach_menu_item(app, capture_item);

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
        window::quit_app(app.clone());
    }
}

/// Reports whether the main window was there to hear it.
fn emit_to_main(app: &AppHandle, event: &str) -> bool {
    let Some(window) = app.get_webview_window(MAIN_WINDOW_LABEL) else {
        return false;
    };

    window.emit(event, ()).is_ok()
}

fn toggle_launch_at_login(item: &CheckMenuItem<tauri::Wry>) {
    let currently_enabled = login::is_enabled();
    let changed = login::set_enabled(!currently_enabled);
    // The checkmark follows what the system actually reports, so a refused
    // toggle leaves the menu telling the truth.
    let enabled = if changed {
        !currently_enabled
    } else {
        login::is_enabled()
    };

    let _ = item.set_checked(enabled);
}

/// Moves an already-enabled LaunchAgent onto `SMAppService` and turns the agent
/// off. A fresh install has no agent, so nothing is registered. Once the agent
/// is gone, later launches leave the checkbox alone, including after the user
/// turns Start at Login off.
#[cfg(not(debug_assertions))]
fn migrate_legacy_launch_agent(app: &AppHandle) {
    if app.autolaunch().is_enabled().unwrap_or(false) {
        let _ = app.autolaunch().disable();
        let _ = login::set_enabled(true);
    }
}
