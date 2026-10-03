import { describe, expect, it, vi } from 'vitest'

import {
  commitDiscardedOverlay,
  ignoresRepeatedSave,
  overlayNeedsPrompt,
  planSave,
} from './overlay'

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

describe('planSave', () => {
  it('writes immediately when no tool marks are waiting', () => {
    expect(planSave(false, null)).toBe('write')
  })

  it('bakes pending marks and then writes when the user applies them', () => {
    expect(planSave(true, 'apply')).toBe('apply-then-write')
  })

  it('writes without baking when the user does not apply the marks', () => {
    expect(planSave(true, 'discard')).toBe('discard-then-write')
  })

  it('aborts when the user cancels the confirmation', () => {
    expect(planSave(true, 'cancel')).toBe('abort')
  })

  it('aborts when marks are waiting and no choice came back', () => {
    expect(planSave(true, null)).toBe('abort')
  })
})

describe('ignoresRepeatedSave', () => {
  it('ignores another save while one is already in flight', () => {
    expect(ignoresRepeatedSave(true)).toBe(true)
  })

  it('allows a save when nothing is in flight', () => {
    expect(ignoresRepeatedSave(false)).toBe(false)
  })
})

describe('commitDiscardedOverlay', () => {
  it('clears the overlay only after a successful write', async () => {
    const clear = vi.fn()

    await expect(commitDiscardedOverlay(async () => true, clear)).resolves.toBe(true)
    expect(clear).toHaveBeenCalledOnce()
  })

  it('does not clear the overlay when the write is cancelled', async () => {
    const clear = vi.fn()

    // false is the save panel being dismissed: no file was written.
    await expect(commitDiscardedOverlay(async () => false, clear)).resolves.toBe(false)
    expect(clear).not.toHaveBeenCalled()
  })

  it('propagates write errors without clearing the overlay', async () => {
    const clear = vi.fn()

    await expect(
      commitDiscardedOverlay(async () => {
        throw new Error('disk full')
      }, clear),
    ).rejects.toThrow('disk full')
    expect(clear).not.toHaveBeenCalled()
  })
})
