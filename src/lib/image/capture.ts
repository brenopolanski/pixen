import { invoke } from '@tauri-apps/api/core'

import { isMacPlatform } from '@/lib/platform'

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

/**
 * Whether this platform has a capture backend. Windows and Linux have none yet,
 * so the action is hidden rather than offered and then failing.
 */
export const supportsCapture = (mac: boolean): boolean => mac

export const isCaptureSupported = (): boolean => supportsCapture(isMacPlatform())
