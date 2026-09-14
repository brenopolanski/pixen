import { describe, expect, it } from 'vitest'

import type { ShortcutEvent } from './shortcuts'
import {
  DEFAULT_CAPTURE_ACCELERATOR,
  eventToAccelerator,
  formatAccelerator,
  formatShortcut,
  isArrowShortcut,
  isCopyImageShortcut,
  isCutoutShortcut,
  isOpenImageShortcut,
  isPixelizeShortcut,
  isReservedShortcut,
  isSaveAsShortcut,
  isSaveShortcut,
  isStepsShortcut,
  shortcutCatalog,
} from './shortcuts'

const event = (overrides: Partial<ShortcutEvent>): ShortcutEvent => ({
  key: 's',
  altKey: false,
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
  ...overrides,
})

describe('isSaveShortcut', () => {
  it('matches Cmd+S', () => {
    expect(isSaveShortcut(event({ metaKey: true }))).toBe(true)
  })

  it('ignores Ctrl+S, which is not a shortcut here', () => {
    expect(isSaveShortcut(event({ ctrlKey: true }))).toBe(false)
  })

  it('ignores S without a modifier', () => {
    expect(isSaveShortcut(event({}))).toBe(false)
  })

  it('does not claim Save As', () => {
    expect(isSaveShortcut(event({ metaKey: true, shiftKey: true }))).toBe(false)
  })

  it('ignores Alt combinations', () => {
    expect(isSaveShortcut(event({ metaKey: true, altKey: true }))).toBe(false)
  })
})

describe('isSaveAsShortcut', () => {
  it('requires Shift alongside Cmd', () => {
    expect(isSaveAsShortcut(event({ key: 'S', metaKey: true, shiftKey: true }))).toBe(true)
    expect(isSaveAsShortcut(event({ metaKey: true }))).toBe(false)
  })
})

describe('isOpenImageShortcut', () => {
  it('matches Cmd+O, but not the shifted variant', () => {
    expect(isOpenImageShortcut(event({ key: 'o', metaKey: true }))).toBe(true)
    expect(isOpenImageShortcut(event({ key: 'O', metaKey: true, shiftKey: true }))).toBe(false)
  })
})

describe('isCopyImageShortcut', () => {
  it('matches the shifted variant', () => {
    expect(isCopyImageShortcut(event({ key: 'C', metaKey: true, shiftKey: true }))).toBe(true)
  })

  it('leaves plain Copy alone, which text fields need', () => {
    expect(isCopyImageShortcut(event({ key: 'c', metaKey: true }))).toBe(false)
  })
})

describe('overlay shortcuts', () => {
  it('matches Cmd+Shift+A for Arrow, and leaves Select All alone', () => {
    expect(isArrowShortcut(event({ key: 'A', metaKey: true, shiftKey: true }))).toBe(true)
    expect(isArrowShortcut(event({ key: 'a', metaKey: true }))).toBe(false)
  })

  it('matches Cmd+Shift+P for Pixelize', () => {
    expect(isPixelizeShortcut(event({ key: 'P', metaKey: true, shiftKey: true }))).toBe(true)
    expect(isPixelizeShortcut(event({ key: 'p', metaKey: true }))).toBe(false)
  })

  it('matches Cmd+Shift+N for Steps', () => {
    expect(isStepsShortcut(event({ key: 'N', metaKey: true, shiftKey: true }))).toBe(true)
    expect(isStepsShortcut(event({ key: 'n', metaKey: true }))).toBe(false)
  })

  it('matches Cmd+Shift+B for Cutout', () => {
    expect(isCutoutShortcut(event({ key: 'B', metaKey: true, shiftKey: true }))).toBe(true)
    expect(isCutoutShortcut(event({ key: 'b', metaKey: true }))).toBe(false)
  })
})

describe('formatShortcut', () => {
  it('uses macOS symbols', () => {
    expect(formatShortcut('s')).toBe('⌘S')
    expect(formatShortcut('s', true)).toBe('⌘⇧S')
    expect(formatShortcut('o')).toBe('⌘O')
  })
})

describe('shortcutCatalog', () => {
  it('lists the keys the README documents, grouped', () => {
    const byGroup = Object.fromEntries(
      shortcutCatalog(DEFAULT_CAPTURE_ACCELERATOR).map((entry) => [
        entry.group,
        entry.items.map((item) => item.keys),
      ]),
    )

    expect(byGroup).toEqual({
      File: ['⌘O', '⌘V', '⌘S', '⌘⇧S', '⌘⇧C', '⌘⇧9'],
      Tools: ['⌘⇧A', '⌘⇧P', '⌘⇧N', '⌘⇧B'],
      App: ['⌘Q', '⌘W', 'Escape'],
    })
  })

  it('follows a rebound capture shortcut', () => {
    const items = shortcutCatalog('CommandOrControl+Alt+8')[0]?.items ?? []

    expect(items[items.length - 1]).toEqual({ keys: '⌘⌥8', action: 'Take a screenshot' })
  })
})

const recorded = (overrides: Partial<ShortcutEvent & { code: string }>) => ({
  ...event({}),
  code: 'Digit9',
  ...overrides,
})

describe('eventToAccelerator', () => {
  it('writes a Tauri accelerator from the physical key', () => {
    expect(eventToAccelerator(recorded({ metaKey: true, shiftKey: true }))).toBe(
      DEFAULT_CAPTURE_ACCELERATOR,
    )
    expect(eventToAccelerator(recorded({ code: 'KeyJ', metaKey: true, altKey: true }))).toBe(
      'CommandOrControl+Alt+J',
    )
    expect(eventToAccelerator(recorded({ code: 'F5', metaKey: true }))).toBe('CommandOrControl+F5')
  })

  it('refuses anything without Command, so typing elsewhere survives', () => {
    expect(eventToAccelerator(recorded({ shiftKey: true }))).toBeNull()
    expect(eventToAccelerator(recorded({ ctrlKey: true }))).toBeNull()
  })

  it('ignores a modifier held on its own, and keys it will not bind', () => {
    expect(eventToAccelerator(recorded({ code: 'ShiftLeft', metaKey: true }))).toBeNull()
    expect(eventToAccelerator(recorded({ code: 'Comma', metaKey: true }))).toBeNull()
  })
})

describe('isReservedShortcut', () => {
  it('refuses combos Pixen already answers', () => {
    expect(isReservedShortcut('CommandOrControl+S')).toBe(true)
    expect(isReservedShortcut('CommandOrControl+Shift+A')).toBe(true)
  })

  it('allows the capture default and a free combo', () => {
    expect(isReservedShortcut(DEFAULT_CAPTURE_ACCELERATOR)).toBe(false)
    expect(isReservedShortcut('CommandOrControl+Shift+8')).toBe(false)
  })
})

describe('formatAccelerator', () => {
  it('writes stored accelerators the way the rest of Pixen does', () => {
    expect(formatAccelerator(DEFAULT_CAPTURE_ACCELERATOR)).toBe('⌘⇧9')
    expect(formatAccelerator('CommandOrControl+J')).toBe('⌘J')
    expect(formatAccelerator('CommandOrControl+Alt+Shift+F5')).toBe('⌘⌥⇧F5')
  })
})
