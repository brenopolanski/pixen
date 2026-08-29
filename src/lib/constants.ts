export const APP_NAME = 'Pixen'
export const APP_TAGLINE = 'Image Editor'
export const UNTITLED_PROJECT_NAME = 'Untitled'

/** Keep in sync with image_mime_type in src-tauri/src/project.rs */
export const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp'] as const

/** Keep in sync with SPLASH_WINDOW_LABEL in src-tauri/src/window.rs */
export const SPLASH_WINDOW_LABEL = 'splash'

/** Floor on how long the splash screen shows, so it never flashes past. */
export const SPLASH_MIN_DURATION_MS = 700
/** Ceiling on waiting for the editor engine before revealing the main window. */
export const EDITOR_PRELOAD_TIMEOUT_MS = 8_000
/** Quiet period after the last interaction before the unsaved check runs. */
export const UNSAVED_CHECK_DEBOUNCE_MS = 600
/** Sweep for edits that finish without a pointer or key release. */
export const UNSAVED_CHECK_INTERVAL_MS = 2_000
/** Recovery snapshots are written at most this often, and only while unsaved. */
export const RECOVERY_INTERVAL_MS = 60_000
