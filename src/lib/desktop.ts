import { getVersion } from '@tauri-apps/api/app'
import { invoke } from '@tauri-apps/api/core'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { ask } from '@tauri-apps/plugin-dialog'

import { ABOUT_WINDOW_LABEL, SPLASH_WINDOW_LABEL } from '@/lib/constants'

/** What the user chose in the unsaved-changes prompt. */
export type CloseDecision = 'save' | 'discard' | 'cancel'

/** Both windows load the same bundle, so the query string picks the view. */
export const isSplashWindow = (): boolean => {
  return new URLSearchParams(window.location.search).get('window') === SPLASH_WINDOW_LABEL
}

export const isAboutWindow = (): boolean => {
  return new URLSearchParams(window.location.search).get('window') === ABOUT_WINDOW_LABEL
}

export const showAboutWindow = (): Promise<void> => {
  return invoke('show_about_window')
}

export const closeCurrentWindow = (): Promise<void> => {
  return getCurrentWindow().close()
}

export const getAppVersion = (): Promise<string> => {
  return getVersion()
}

/** Reveals the main window and dismisses the splash screen. */
export const finishLaunch = (): Promise<void> => {
  return invoke('finish_launch')
}

export const quitApp = (): Promise<void> => {
  return invoke('quit_app')
}

export const setWindowTitle = (title: string): Promise<void> => {
  return getCurrentWindow().setTitle(title)
}

/**
 * Takes over the window's close button so unsaved work can be guarded. The
 * handler decides when — or whether — to call `quitApp`.
 */
export const onCloseRequested = (handler: () => void): Promise<() => void> => {
  return getCurrentWindow()
    .onCloseRequested((event) => {
      event.preventDefault()
      handler()
    })
    .then((unlisten) => () => unlisten())
}

/** Where a drag currently is, as far as the window is concerned. */
export type DragState = 'over' | 'away'

/**
 * Tauri intercepts file drops before the webview sees them, so `dragover` and
 * `drop` never fire — the window's own event is the only source. Paths arrive
 * unfiltered: whatever the user was dragging.
 */
export const onFileDrop = (
  onDragStateChange: (state: DragState) => void,
  onDrop: (paths: string[]) => void,
): Promise<() => void> => {
  return getCurrentWindow()
    .onDragDropEvent(({ payload }) => {
      if (payload.type === 'enter' || payload.type === 'over') {
        onDragStateChange('over')
        return
      }

      onDragStateChange('away')

      if (payload.type === 'drop') {
        onDrop(payload.paths)
      }
    })
    .then((unlisten) => () => unlisten())
}

/** Native three-button prompt; see confirm_unsaved_changes in Rust. */
export const askAboutUnsavedChanges = (): Promise<CloseDecision> => {
  return invoke('confirm_unsaved_changes')
}

/** Native two-button prompt; resolves true when the user confirms. */
export const askToDiscardChanges = (): Promise<boolean> => {
  return ask('The changes you made since the last save will be lost.', {
    title: 'Discard unsaved changes?',
    kind: 'warning',
    okLabel: 'Discard',
    cancelLabel: 'Cancel',
  })
}
