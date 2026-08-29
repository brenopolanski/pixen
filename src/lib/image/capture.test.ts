import { describe, expect, it } from 'vitest'

import { supportsCapture } from './capture'

describe('supportsCapture', () => {
  it('offers capture on macOS', () => {
    expect(supportsCapture(true)).toBe(true)
  })

  it('withholds it where there is no capture backend', () => {
    expect(supportsCapture(false)).toBe(false)
  })
})
