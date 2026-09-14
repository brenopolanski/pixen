/** The keyboard-event fields a shortcut match depends on. */
export interface ShortcutEvent {
  key: string
  altKey: boolean
  ctrlKey: boolean
  metaKey: boolean
  shiftKey: boolean
}

/** ⌘, never Control: Pixen is a macOS app. */
const hasPrimaryModifier = (event: ShortcutEvent): boolean => event.metaKey && !event.ctrlKey

const matches = (event: ShortcutEvent, key: string, shift: boolean): boolean =>
  hasPrimaryModifier(event) &&
  !event.altKey &&
  event.shiftKey === shift &&
  event.key.toLowerCase() === key

export const isSaveShortcut = (event: ShortcutEvent): boolean => matches(event, 's', false)

export const isSaveAsShortcut = (event: ShortcutEvent): boolean => matches(event, 's', true)

export const isOpenImageShortcut = (event: ShortcutEvent): boolean => matches(event, 'o', false)

/**
 * Shift is part of it deliberately. Plain ⌘C belongs to the system Copy, which
 * the editor's text tool and Pixen's own inputs need; ⌘⇧C is what other
 * editors use for copying the image itself.
 */
export const isCopyImageShortcut = (event: ShortcutEvent): boolean => matches(event, 'c', true)

/** Shift so plain ⌘A stays Select All. */
export const isArrowShortcut = (event: ShortcutEvent): boolean => matches(event, 'a', true)

export const isPixelizeShortcut = (event: ShortcutEvent): boolean => matches(event, 'p', true)

export const isStepsShortcut = (event: ShortcutEvent): boolean => matches(event, 'n', true)

export const isCutoutShortcut = (event: ShortcutEvent): boolean => matches(event, 'b', true)

/** Writes a shortcut the way macOS writes it. */
export const formatShortcut = (key: string, shift = false): string =>
  `⌘${shift ? '⇧' : ''}${key.toUpperCase()}`

/**
 * The capture combo before the user picks another one.
 *
 * Keep in sync with DEFAULT_CAPTURE_SHORTCUT in src-tauri/src/shortcut.rs
 */
export const DEFAULT_CAPTURE_ACCELERATOR = 'CommandOrControl+Shift+9'

/**
 * Combos Pixen already answers, in the canonical shape `eventToAccelerator`
 * writes. Rebinding capture onto one of these would shadow it.
 *
 * Keep in sync with RESERVED in src-tauri/src/shortcut.rs
 */
export const RESERVED_SHORTCUTS: readonly string[] = [
  // Pixen's own menu and toolbar actions.
  'CommandOrControl+O',
  'CommandOrControl+V',
  'CommandOrControl+S',
  'CommandOrControl+Shift+S',
  'CommandOrControl+Shift+C',
  'CommandOrControl+Shift+A',
  'CommandOrControl+Shift+P',
  'CommandOrControl+Shift+N',
  'CommandOrControl+Shift+B',
  'CommandOrControl+Q',
  'CommandOrControl+W',
  // The system Edit menu Pixen rebuilds; text fields stop working without it.
  'CommandOrControl+Z',
  'CommandOrControl+Shift+Z',
  'CommandOrControl+X',
  'CommandOrControl+C',
  'CommandOrControl+A',
  // App chrome.
  'CommandOrControl+H',
  'CommandOrControl+M',
]

export const isReservedShortcut = (accelerator: string): boolean =>
  RESERVED_SHORTCUTS.includes(accelerator)

/**
 * True while the Settings recorder is listening, so Save and the overlay
 * tools do not fire from the same keystroke that is being bound.
 */
let recordingCaptureShortcut = false

export const setRecordingCaptureShortcut = (recording: boolean): void => {
  recordingCaptureShortcut = recording
}

export const isRecordingCaptureShortcut = (): boolean => recordingCaptureShortcut

/**
 * The physical key, not the character it produces: with Shift held, `key` for
 * the 9 is `(` on a US layout, and something else again elsewhere. Only
 * letters, digits and function keys are offered — enough for a hotkey, and it
 * keeps punctuation layouts out of it.
 */
const acceleratorKey = (code: string): string | null => {
  const letter = /^Key([A-Z])$/.exec(code)

  if (letter) {
    return letter[1]
  }

  const digit = /^Digit([0-9])$/.exec(code)

  if (digit) {
    return digit[1]
  }

  return /^F([1-9]|1[0-9]|20)$/.test(code) ? code : null
}

/**
 * Turns a recorded keypress into a Tauri accelerator, or null when it is not
 * something Pixen will bind.
 *
 * Command is required: without it a system-wide hotkey would swallow ordinary
 * typing in every other app.
 */
export const eventToAccelerator = (event: ShortcutEvent & { code: string }): string | null => {
  if (!event.metaKey) {
    return null
  }

  const key = acceleratorKey(event.code)

  if (!key) {
    return null
  }

  const parts = ['CommandOrControl']

  if (event.altKey) {
    parts.push('Alt')
  }

  if (event.shiftKey) {
    parts.push('Shift')
  }

  parts.push(key)

  return parts.join('+')
}

/** Writes a stored accelerator the way the rest of Pixen writes shortcuts. */
export const formatAccelerator = (accelerator: string): string => {
  const parts = accelerator.split('+')
  const key = parts[parts.length - 1] ?? ''
  const alt = parts.includes('Alt') || parts.includes('Option')
  const shift = parts.includes('Shift')

  return `⌘${alt ? '⌥' : ''}${shift ? '⇧' : ''}${key.toUpperCase()}`
}

export interface ShortcutCatalogItem {
  keys: string
  action: string
}

export interface ShortcutCatalogGroup {
  group: string
  items: ShortcutCatalogItem[]
}

/**
 * What the shortcuts dialog shows. Keys that `formatShortcut` can write go
 * through it so a matcher change and the help list stay on the same string.
 *
 * Capture is passed in rather than hard-coded: it is the one combo the user
 * can rebind.
 */
export const shortcutCatalog = (captureAccelerator: string): ShortcutCatalogGroup[] => [
  {
    group: 'File',
    items: [
      { keys: formatShortcut('o'), action: 'Open an image' },
      { keys: formatShortcut('v'), action: 'Paste an image' },
      { keys: formatShortcut('s'), action: 'Save' },
      { keys: formatShortcut('s', true), action: 'Save As' },
      { keys: formatShortcut('c', true), action: 'Copy the image' },
      { keys: formatAccelerator(captureAccelerator), action: 'Take a screenshot' },
    ],
  },
  {
    group: 'Tools',
    items: [
      { keys: formatShortcut('a', true), action: 'Arrow' },
      { keys: formatShortcut('p', true), action: 'Pixelize' },
      { keys: formatShortcut('n', true), action: 'Numbered steps' },
      { keys: formatShortcut('b', true), action: 'Remove background' },
    ],
  },
  {
    group: 'App',
    items: [
      { keys: '⌘Q', action: 'Quit' },
      { keys: '⌘W', action: 'Close About' },
      { keys: 'Escape', action: 'Cancel overlay or close About' },
    ],
  },
]
