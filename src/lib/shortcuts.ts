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
 */
export const SHORTCUT_CATALOG: ShortcutCatalogGroup[] = [
  {
    group: 'File',
    items: [
      { keys: formatShortcut('o'), action: 'Open an image' },
      { keys: formatShortcut('v'), action: 'Paste an image' },
      { keys: formatShortcut('s'), action: 'Save' },
      { keys: formatShortcut('s', true), action: 'Save As' },
      { keys: formatShortcut('c', true), action: 'Copy the image' },
      { keys: formatShortcut('9', true), action: 'Take a screenshot' },
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
