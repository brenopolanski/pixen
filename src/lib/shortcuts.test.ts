import { describe, expect, it } from 'vitest'

import type { ShortcutEvent } from './shortcuts'
import {
  formatShortcut,
  isOpenImageShortcut,
  isOpenProjectShortcut,
  isSaveAsShortcut,
  isSaveShortcut,
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
  it('matches Cmd+S on macOS', () => {
    expect(isSaveShortcut(event({ metaKey: true }), true)).toBe(true)
  })

  it('matches Ctrl+S on Windows and Linux', () => {
    expect(isSaveShortcut(event({ ctrlKey: true }), false)).toBe(true)
  })

  it('ignores the wrong modifier for the platform', () => {
    expect(isSaveShortcut(event({ ctrlKey: true }), true)).toBe(false)
    expect(isSaveShortcut(event({ metaKey: true }), false)).toBe(false)
  })

  it('ignores S without a modifier', () => {
    expect(isSaveShortcut(event({}), true)).toBe(false)
  })

  it('does not claim Save As', () => {
    expect(isSaveShortcut(event({ metaKey: true, shiftKey: true }), true)).toBe(false)
  })

  it('ignores Alt combinations', () => {
    expect(isSaveShortcut(event({ metaKey: true, altKey: true }), true)).toBe(false)
  })
})

describe('isSaveAsShortcut', () => {
  it('requires Shift alongside the primary modifier', () => {
    expect(isSaveAsShortcut(event({ key: 'S', metaKey: true, shiftKey: true }), true)).toBe(true)
    expect(isSaveAsShortcut(event({ metaKey: true }), true)).toBe(false)
  })
})

describe('open shortcuts', () => {
  it('separates opening an image from opening a project', () => {
    const open = event({ key: 'o', ctrlKey: true })
    const openShifted = event({ key: 'O', ctrlKey: true, shiftKey: true })

    expect(isOpenImageShortcut(open, false)).toBe(true)
    expect(isOpenProjectShortcut(open, false)).toBe(false)
    expect(isOpenProjectShortcut(openShifted, false)).toBe(true)
    expect(isOpenImageShortcut(openShifted, false)).toBe(false)
  })
})

describe('formatShortcut', () => {
  it('uses macOS symbols', () => {
    expect(formatShortcut(true, 's')).toBe('⌘S')
    expect(formatShortcut(true, 's', true)).toBe('⌘⇧S')
  })

  it('spells out Windows and Linux modifiers', () => {
    expect(formatShortcut(false, 'o')).toBe('Ctrl+O')
    expect(formatShortcut(false, 'o', true)).toBe('Ctrl+Shift+O')
  })
})
