import { describe, expect, it } from 'vitest'

import { DEFAULT_SETTINGS, parseSettings } from './settings'

describe('parseSettings', () => {
  it('reads a stored light theme', () => {
    expect(parseSettings(JSON.stringify({ theme: 'light' }))).toEqual({ theme: 'light' })
  })

  it('reads a stored dark theme', () => {
    expect(parseSettings(JSON.stringify({ theme: 'dark' }))).toEqual({ theme: 'dark' })
  })

  it('falls back when the key is missing', () => {
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS)
    expect(parseSettings(JSON.stringify({}))).toEqual(DEFAULT_SETTINGS)
  })

  it('falls back on garbage', () => {
    expect(parseSettings('not-json')).toEqual(DEFAULT_SETTINGS)
    expect(parseSettings(JSON.stringify({ theme: 'sepia' }))).toEqual(DEFAULT_SETTINGS)
    expect(parseSettings(JSON.stringify(['dark']))).toEqual(DEFAULT_SETTINGS)
  })
})
