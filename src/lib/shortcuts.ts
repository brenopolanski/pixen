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
