use serde::Serialize;
use tauri::AppHandle;
use tauri_plugin_dialog::{
    DialogExt, MessageDialogButtons, MessageDialogKind, MessageDialogResult,
};

const SAVE_LABEL: &str = "Save";
const DISCARD_LABEL: &str = "Don't Save";
const CANCEL_LABEL: &str = "Cancel";

#[derive(Serialize)]
#[serde(rename_all = "lowercase")]
pub enum CloseDecision {
    Save,
    Discard,
    Cancel,
}

/// The three-button unsaved-changes prompt. It lives in Rust because the
/// JavaScript dialog API only offers two buttons, and "Cancel" has to be a
/// distinct answer from "Don't Save".
///
/// `async` keeps the blocking dialog off the main thread, where it would stall
/// the window it is asking about.
#[tauri::command]
pub async fn confirm_unsaved_changes(app: AppHandle) -> CloseDecision {
    let result = app
        .dialog()
        .message("Your changes will be lost if you close Pixen without saving them.")
        .title("You have unsaved changes.")
        .kind(MessageDialogKind::Warning)
        .buttons(MessageDialogButtons::YesNoCancelCustom(
            SAVE_LABEL.to_string(),
            DISCARD_LABEL.to_string(),
            CANCEL_LABEL.to_string(),
        ))
        .blocking_show_with_result();

    match result {
        // Platforms that cannot render custom labels fall back to Yes/No.
        MessageDialogResult::Yes | MessageDialogResult::Ok => CloseDecision::Save,
        MessageDialogResult::No => CloseDecision::Discard,
        MessageDialogResult::Custom(label) if label == SAVE_LABEL => CloseDecision::Save,
        MessageDialogResult::Custom(label) if label == DISCARD_LABEL => CloseDecision::Discard,
        _ => CloseDecision::Cancel,
    }
}

const APPLY_LABEL: &str = "Apply";
const DONT_APPLY_LABEL: &str = "Don't Apply";

#[derive(Serialize)]
#[serde(rename_all = "lowercase")]
pub enum OverlayDecision {
    Apply,
    Discard,
    Cancel,
}

/// Three-button prompt when leaving a tool that still has unapplied marks.
/// Apply bakes them onto the image; it does not write a file.
#[tauri::command]
pub async fn confirm_apply_overlay(app: AppHandle) -> OverlayDecision {
    let result = app
        .dialog()
        .message("The marks you added in this tool are not on the image yet.")
        .title("Apply these changes?")
        .kind(MessageDialogKind::Warning)
        .buttons(MessageDialogButtons::YesNoCancelCustom(
            APPLY_LABEL.to_string(),
            DONT_APPLY_LABEL.to_string(),
            CANCEL_LABEL.to_string(),
        ))
        .blocking_show_with_result();

    match result {
        MessageDialogResult::Yes | MessageDialogResult::Ok => OverlayDecision::Apply,
        MessageDialogResult::No => OverlayDecision::Discard,
        MessageDialogResult::Custom(label) if label == APPLY_LABEL => OverlayDecision::Apply,
        MessageDialogResult::Custom(label) if label == DONT_APPLY_LABEL => OverlayDecision::Discard,
        _ => OverlayDecision::Cancel,
    }
}
