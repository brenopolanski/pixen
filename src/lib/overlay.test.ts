import { describe, expect, it } from 'vitest'

import { overlayNeedsPrompt } from './overlay'

describe('overlayNeedsPrompt', () => {
  it('asks when an arrow, a step or a pixelize box has been drawn', () => {
    expect(overlayNeedsPrompt({ type: 'arrow', arrows: [] })).toBe(false)
    expect(
      overlayNeedsPrompt({
        type: 'arrow',
        arrows: [{ from: { x: 0, y: 0 }, to: { x: 10, y: 10 } }],
      }),
    ).toBe(true)
    expect(overlayNeedsPrompt({ type: 'increment', stamps: [] })).toBe(false)
    expect(overlayNeedsPrompt({ type: 'increment', stamps: [{ step: 1, x: 4, y: 4 }] })).toBe(true)
    expect(overlayNeedsPrompt({ type: 'pixelize', regions: [] })).toBe(false)
    expect(
      overlayNeedsPrompt({ type: 'pixelize', regions: [{ x: 2, y: 2, width: 8, height: 8 }] }),
    ).toBe(true)
  })

  it('asks only after a cutout preview is ready', () => {
    expect(overlayNeedsPrompt({ type: 'cutout', image: null })).toBe(false)
    expect(overlayNeedsPrompt({ type: 'cutout', image: 'data:image/png;base64,aa' })).toBe(true)
  })

  it('never asks when nothing is open', () => {
    expect(overlayNeedsPrompt({ type: 'none' })).toBe(false)
  })
})
