import { describe, expect, it } from 'vitest'

import type { ShortcutEvent } from './shortcuts'
import {
  formatShortcut,
  isCopyImageShortcut,
  isOpenImageShortcut,
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

describe('formatShortcut', () => {
  it('uses macOS symbols', () => {
    expect(formatShortcut('s')).toBe('⌘S')
    expect(formatShortcut('s', true)).toBe('⌘⇧S')
    expect(formatShortcut('o')).toBe('⌘O')
  })
})
