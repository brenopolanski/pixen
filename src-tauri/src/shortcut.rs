use std::str::FromStr;
use std::sync::Mutex;

use serde::{Deserialize, Serialize};
use tauri::menu::MenuItem;
use tauri::{AppHandle, Manager, Wry};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Modifiers, Shortcut};

/// What macOS takes a screenshot with everywhere else, and what Lightshot
/// binds too. Registered system-wide so it fires while another app is in
/// front, which is the whole point of the tray.
pub const DEFAULT_CAPTURE_SHORTCUT: &str = "CommandOrControl+Shift+9";

/// Survives a relaunch next to the autostart marker rather than in the
/// webview's storage: the shortcut has to be registered during `setup`, long
/// before there is a webview to ask.
const CONFIG_FILE: &str = "capture-shortcut.json";

/// Combos Pixen already answers. Rebinding capture onto one of these would
/// shadow it, and the check lives here as well as in the recorder so a crafted
/// `invoke` cannot take Save or Quit away.
///
/// Keep in sync with RESERVED_SHORTCUTS in src/lib/shortcuts.ts
const RESERVED: &[&str] = &[
    // Pixen's own menu and toolbar actions.
    "CommandOrControl+O",
    "CommandOrControl+V",
    "CommandOrControl+S",
    "CommandOrControl+Shift+S",
    "CommandOrControl+Shift+C",
    "CommandOrControl+Shift+A",
    "CommandOrControl+Shift+P",
    "CommandOrControl+Shift+N",
    "CommandOrControl+Shift+B",
    "CommandOrControl+Q",
    "CommandOrControl+W",
    // The system Edit menu Pixen rebuilds; text fields stop working without it.
    "CommandOrControl+Z",
    "CommandOrControl+Shift+Z",
    "CommandOrControl+X",
    "CommandOrControl+C",
    "CommandOrControl+A",
    // App chrome.
    "CommandOrControl+H",
    "CommandOrControl+M",
    "CommandOrControl+,",
    "CommandOrControl+Shift+/",
];

#[derive(Deserialize, Serialize)]
struct StoredShortcut {
    accelerator: String,
}

/// The accelerator in force, plus the tray item that displays it.
#[derive(Default)]
pub struct CaptureShortcut {
    accelerator: Mutex<String>,
    menu_item: Mutex<Option<MenuItem<Wry>>>,
}

impl CaptureShortcut {
    pub fn accelerator(&self) -> String {
        self.accelerator
            .lock()
            .map(|value| value.clone())
            .unwrap_or_else(|_| DEFAULT_CAPTURE_SHORTCUT.to_string())
    }
}

/// Reads the stored accelerator and registers it, falling back to the default
/// when the file is missing or the combo is no longer available.
///
/// A failure to register is not fatal: the tray and the menus still work, and
/// the recorder can be used to pick something the system will accept.
pub fn init(app: &AppHandle) {
    let stored = read_stored(app).unwrap_or_else(|| DEFAULT_CAPTURE_SHORTCUT.to_string());
    let accelerator = match register(app, &stored) {
        Ok(()) => stored,
        Err(_) => {
            let _ = register(app, DEFAULT_CAPTURE_SHORTCUT);
            DEFAULT_CAPTURE_SHORTCUT.to_string()
        }
    };

    app.manage(CaptureShortcut {
        accelerator: Mutex::new(accelerator),
        menu_item: Mutex::new(None),
    });
}

/// Lets the tray's Take Screenshot item follow a rebind. Called once the tray
/// is built, since the item does not exist when `init` runs.
pub fn attach_menu_item(app: &AppHandle, item: MenuItem<Wry>) {
    let state = app.state::<CaptureShortcut>();
    let Ok(mut slot) = state.menu_item.lock() else {
        return;
    };

    *slot = Some(item);
}

#[tauri::command]
pub fn get_capture_shortcut(app: AppHandle) -> String {
    app.state::<CaptureShortcut>().accelerator()
}

/// Rebinds capture. The old combo is only released once the new one parses and
/// is not one of Pixen's own, and it is put back if the system refuses the new
/// one — a rejected change must never leave the app with no way to capture.
#[tauri::command]
pub fn set_capture_shortcut(app: AppHandle, accelerator: String) -> Result<String, String> {
    let parsed = parse(&accelerator)?;
    let current = app.state::<CaptureShortcut>().accelerator();

    if parse(&current).is_ok_and(|existing| existing == parsed) {
        return Ok(current);
    }

    if is_reserved(&parsed) {
        return Err("Pixen already uses that shortcut.".to_string());
    }

    let _ = app
        .global_shortcut()
        .unregister(parsed_or_default(&current));

    if register(&app, &accelerator).is_err() {
        let _ = register(&app, &current);
        return Err("Another app is already using that shortcut.".to_string());
    }

    remember(&app, &accelerator);

    Ok(accelerator)
}

/// Drops the live binding without forgetting the stored combo, so the
/// recorder can hear the current keys instead of starting a capture.
#[tauri::command]
pub fn suspend_capture_shortcut(app: AppHandle) {
    let current = app.state::<CaptureShortcut>().accelerator();
    let _ = app
        .global_shortcut()
        .unregister(parsed_or_default(&current));
}

/// Puts the stored combo back after the recorder closes without a new one.
#[tauri::command]
pub fn restore_capture_shortcut(app: AppHandle) {
    let current = app.state::<CaptureShortcut>().accelerator();

    if app
        .global_shortcut()
        .is_registered(parsed_or_default(&current))
    {
        return;
    }

    let _ = register(&app, &current);
}

fn parse(accelerator: &str) -> Result<Shortcut, String> {
    let shortcut =
        Shortcut::from_str(accelerator).map_err(|_| "That is not a shortcut.".to_string())?;

    // CommandOrControl is Command here. Without it the combo would swallow
    // plain typing in every other app, which a system-wide hotkey must not do.
    if !shortcut
        .mods
        .intersects(Modifiers::SUPER | Modifiers::CONTROL)
    {
        return Err("Use Command as part of the shortcut.".to_string());
    }

    Ok(shortcut)
}

/// Falls back to the default so a corrupted stored value cannot leave the old
/// registration in place forever.
fn parsed_or_default(accelerator: &str) -> Shortcut {
    Shortcut::from_str(accelerator).unwrap_or_else(|_| {
        Shortcut::from_str(DEFAULT_CAPTURE_SHORTCUT).expect("the default shortcut parses")
    })
}

fn is_reserved(shortcut: &Shortcut) -> bool {
    RESERVED
        .iter()
        .filter_map(|entry| Shortcut::from_str(entry).ok())
        .any(|reserved| reserved == *shortcut)
}

fn register(app: &AppHandle, accelerator: &str) -> Result<(), String> {
    let shortcut = parse(accelerator)?;

    app.global_shortcut()
        .register(shortcut)
        .map_err(|_| "That shortcut could not be registered.".to_string())
}

/// Stores the accelerator and points the tray item at it. The in-memory copy
/// is what every label reads, so it is updated even if the write fails.
fn remember(app: &AppHandle, accelerator: &str) {
    let state = app.state::<CaptureShortcut>();

    if let Ok(mut current) = state.accelerator.lock() {
        *current = accelerator.to_string();
    }

    if let Ok(item) = state.menu_item.lock() {
        if let Some(item) = item.as_ref() {
            let _ = item.set_accelerator(Some(accelerator));
        }
    }

    write_stored(app, accelerator);
}

fn read_stored(app: &AppHandle) -> Option<String> {
    let path = app.path().app_config_dir().ok()?.join(CONFIG_FILE);
    let raw = std::fs::read_to_string(path).ok()?;
    let stored: StoredShortcut = serde_json::from_str(&raw).ok()?;

    Some(stored.accelerator)
}

fn write_stored(app: &AppHandle, accelerator: &str) {
    let Ok(dir) = app.path().app_config_dir() else {
        return;
    };

    let _ = std::fs::create_dir_all(&dir);

    let stored = StoredShortcut {
        accelerator: accelerator.to_string(),
    };

    if let Ok(raw) = serde_json::to_string(&stored) {
        let _ = std::fs::write(dir.join(CONFIG_FILE), raw);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_default_is_a_valid_shortcut_and_not_reserved() {
        let parsed = parse(DEFAULT_CAPTURE_SHORTCUT).expect("the default parses");

        assert!(!is_reserved(&parsed));
    }

    #[test]
    fn refuses_shortcuts_pixen_already_answers() {
        for entry in [
            "CommandOrControl+S",
            "CommandOrControl+Shift+C",
            "CommandOrControl+,",
            "CommandOrControl+Shift+/",
        ] {
            let parsed = parse(entry).expect("the reserved entry parses");

            assert!(is_reserved(&parsed), "{entry} should be reserved");
        }
    }

    #[test]
    fn requires_command() {
        assert!(parse("Shift+9").is_err());
        assert!(parse("F5").is_err());
        assert!(parse("CommandOrControl+Shift+8").is_ok());
    }

    #[test]
    fn rejects_nonsense() {
        assert!(parse("").is_err());
        assert!(parse("NotAKey").is_err());
    }
}
