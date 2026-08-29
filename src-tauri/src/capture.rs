use std::fs;
use std::path::PathBuf;
use std::process::Command;
use std::time::{SystemTime, UNIX_EPOCH};

use tauri::{AppHandle, Manager};

use crate::image::{read_as_data_url, Format};
use crate::window::MAIN_WINDOW_LABEL;

/// macOS's own capture tool, which is what gives Pixen the same crosshair as
/// Cmd+Shift+4 without shipping a capture stack of its own.
const SCREENCAPTURE: &str = "/usr/sbin/screencapture";

/// Somewhere to land the shot before it is read and deleted. The stamp keeps
/// two captures in the same session from colliding.
fn screenshot_path() -> PathBuf {
    let stamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|elapsed| elapsed.as_nanos())
        .unwrap_or_default();

    std::env::temp_dir().join(format!("pixen-screenshot-{stamp}.png"))
}

/// Runs the capture and reports whether it produced a file.
///
/// Success is decided by the output file existing rather than by the exit
/// status, which is undocumented for this tool. Escape cancels the selection
/// and holding Control diverts the shot to the clipboard; both leave no file,
/// and neither is a failure.
fn run_screencapture(path: &PathBuf) -> Result<bool, String> {
    // -i selects interactively, so Space still switches to window capture.
    // -o drops the window shadow, -d lets macOS report real errors itself.
    let _status = Command::new(SCREENCAPTURE)
        .args(["-i", "-o", "-d", "-t", "png"])
        .arg(path)
        .status()
        .map_err(|_| "Pixen could not start the macOS screenshot tool.".to_string())?;

    Ok(path.exists())
}

/// Captures a region of the screen and returns it as a data URL.
///
/// `None` means the user cancelled, which is not an error — the same contract
/// the file dialogs use.
///
/// `async` because the capture blocks until the selection is finished, which
/// would otherwise stall the window this command was invoked from.
#[tauri::command]
pub async fn capture_screen(app: AppHandle) -> Result<Option<String>, String> {
    let path = screenshot_path();
    let main = app.get_webview_window(MAIN_WINDOW_LABEL);

    // Pixen would otherwise cover whatever the user is trying to capture. The
    // window is restored below on every path, including cancellation.
    if let Some(window) = &main {
        let _ = window.hide();
    }

    let captured = run_screencapture(&path);

    if let Some(window) = &main {
        let _ = window.show();
        let _ = window.set_focus();
    }

    if !captured? {
        return Ok(None);
    }

    let data_url = read_as_data_url(&path, Format::Png);

    // Read or not, the temp file has served its purpose.
    let _ = fs::remove_file(&path);

    data_url.map(Some)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn screenshot_paths_are_unique_temp_pngs() {
        let first = screenshot_path();
        let second = screenshot_path();

        assert!(first.starts_with(std::env::temp_dir()));
        assert_eq!(
            first.extension().and_then(|value| value.to_str()),
            Some("png")
        );
        assert_ne!(first, second);
    }
}
