export const APP_NAME = 'Pixen'
export const APP_TAGLINE = 'Image Editor'
export const UNTITLED_NAME = 'Untitled'
/** Names a captured screenshot, so its first save offers Screenshot.png. */
export const SCREENSHOT_NAME = 'Screenshot'

/** Keep in sync with image_mime_type in src-tauri/src/image.rs */
export const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp'] as const

/** Keep in sync with SPLASH_WINDOW_LABEL in src-tauri/src/window.rs */
export const SPLASH_WINDOW_LABEL = 'splash'
/** Keep in sync with ABOUT_WINDOW_LABEL in src-tauri/src/window.rs */
export const ABOUT_WINDOW_LABEL = 'about'

/**
 * Class on every editor mount. The Save/Cancel hide rule in `index.css` keys
 * off this rather than a single id, because each tab has its own editor.
 */
export const EDITOR_CONTAINER_CLASS = 'pixen-editor'

/** Prefix for a tab's editor id: `pixen-editor-${tabId}`. */
export const EDITOR_CONTAINER_ID_PREFIX = 'pixen-editor'

export const editorContainerId = (tabId: string): string => {
  return `${EDITOR_CONTAINER_ID_PREFIX}-${tabId}`
}

/** How many images can be open at once. Opening past this asks to close a tab. */
export const MAX_TABS = 5

/** Floor on how long the splash screen shows, so it never flashes past. */
export const SPLASH_MIN_DURATION_MS = 700
/** Ceiling on waiting for the editor engine before revealing the main window. */
export const EDITOR_PRELOAD_TIMEOUT_MS = 8_000
/**
 * How long the copy toast stays up. Longer than the inline label it replaced,
 * because a corner of the window takes a moment to notice.
 */
export const COPIED_FEEDBACK_MS = 2_500
/** Quiet period after the last interaction before the unsaved check runs. */
export const UNSAVED_CHECK_DEBOUNCE_MS = 600
/** Sweep for edits that finish without a pointer or key release. */
export const UNSAVED_CHECK_INTERVAL_MS = 2_000
