import { describe, expect, it } from 'vitest'

import { shouldRevealCapturedImage } from './captureReveal'

describe('shouldRevealCapturedImage', () => {
  it('does not reveal the fullscreen space when the image was not inserted', () => {
    expect(shouldRevealCapturedImage(false)).toBe(false)
  })

  it('reveals after the screenshot was inserted', () => {
    expect(shouldRevealCapturedImage(true)).toBe(true)
  })
})
