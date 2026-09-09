import { invoke } from '@tauri-apps/api/core'

/**
 * Interactive region capture, backed by macOS's own `screencapture`.
 *
 * Resolves to null when the user cancels — Escape, or diverting the shot to the
 * clipboard with Control — which is never an error, the same as a dismissed
 * dialog.
 */
export const captureScreen = (): Promise<string | null> => {
  return invoke('capture_screen')
}
