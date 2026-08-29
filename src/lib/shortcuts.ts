/** The keyboard-event fields a shortcut match depends on. */
export interface ShortcutEvent {
  key: string
  altKey: boolean
  ctrlKey: boolean
  metaKey: boolean
  shiftKey: boolean
}

/** macOS uses ⌘; Windows and Linux use Ctrl. Never both. */
const hasPrimaryModifier = (event: ShortcutEvent, mac: boolean): boolean =>
  mac ? event.metaKey && !event.ctrlKey : event.ctrlKey && !event.metaKey

const matches = (event: ShortcutEvent, mac: boolean, key: string, shift: boolean): boolean =>
  hasPrimaryModifier(event, mac) &&
  !event.altKey &&
  event.shiftKey === shift &&
  event.key.toLowerCase() === key

export const isSaveShortcut = (event: ShortcutEvent, mac: boolean): boolean =>
  matches(event, mac, 's', false)

export const isSaveAsShortcut = (event: ShortcutEvent, mac: boolean): boolean =>
  matches(event, mac, 's', true)

export const isOpenImageShortcut = (event: ShortcutEvent, mac: boolean): boolean =>
  matches(event, mac, 'o', false)

/** Writes a shortcut the way the host platform writes it. */
export const formatShortcut = (mac: boolean, key: string, shift = false): string =>
  mac
    ? `⌘${shift ? '⇧' : ''}${key.toUpperCase()}`
    : `Ctrl+${shift ? 'Shift+' : ''}${key.toUpperCase()}`
