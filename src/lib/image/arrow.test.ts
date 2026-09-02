import { describe, expect, it } from 'vitest'

import { arrowOutline, clampPixel, isUsableArrow, MIN_ARROW_LENGTH } from './arrow'

describe('clampPixel', () => {
  const box = { width: 400, height: 400 }
  // Displayed at 400x200, offset 100 from the top: one CSS pixel is two image
  // pixels.
  const image = { width: 800, height: 400 }

  it('scales a point on the image up to a pixel', () => {
    expect(clampPixel(box, image, { x: 100, y: 150 })).toEqual({ x: 200, y: 100 })
  })

  it('pulls a point dragged into the letterbox back onto the image', () => {
    expect(clampPixel(box, image, { x: 100, y: 40 })).toEqual({ x: 200, y: 0 })
    expect(clampPixel(box, image, { x: 100, y: 360 })).toEqual({ x: 200, y: 399 })
  })

  it('pulls a point dragged past the far corner back inside', () => {
    expect(clampPixel(box, image, { x: 900, y: 900 })).toEqual({ x: 799, y: 399 })
  })

  // A small image is blown up to fill the frame, so its visible corner has to
  // map to its first pixel rather than being clamped in from the edge.
  it('reaches the visible corner of a small image', () => {
    expect(clampPixel(box, { width: 100, height: 50 }, { x: 0, y: 100 })).toEqual({ x: 0, y: 0 })
  })

  it('collapses when there is nothing to measure against', () => {
    expect(clampPixel({ width: 0, height: 0 }, image, { x: 10, y: 10 })).toEqual({ x: 0, y: 0 })
  })
})

describe('isUsableArrow', () => {
  it('keeps a drag long enough to read as a direction', () => {
    expect(isUsableArrow({ from: { x: 0, y: 0 }, to: { x: 0, y: MIN_ARROW_LENGTH } })).toBe(true)
  })

  it('refuses a slip of the mouse', () => {
    expect(isUsableArrow({ from: { x: 0, y: 0 }, to: { x: 0, y: MIN_ARROW_LENGTH - 1 } })).toBe(
      false,
    )
  })

  it('refuses a press with no drag at all', () => {
    expect(isUsableArrow({ from: { x: 40, y: 40 }, to: { x: 40, y: 40 } })).toBe(false)
  })
})

describe('arrowOutline', () => {
  it('stops the shaft short of the tip and squares the head across it', () => {
    expect(arrowOutline({ from: { x: 0, y: 0 }, to: { x: 100, y: 0 } })).toEqual({
      shaftEnd: { x: 78, y: 0 },
      left: { x: 78, y: 10 },
      right: { x: 78, y: -10 },
    })
  })

  it('keeps the head from reaching behind the tail on a short arrow', () => {
    const outline = arrowOutline({ from: { x: 0, y: 0 }, to: { x: 10, y: 0 } })

    expect(outline?.shaftEnd).toEqual({ x: 0, y: 0 })
  })

  it('has nothing to draw for an arrow with no length', () => {
    expect(arrowOutline({ from: { x: 5, y: 5 }, to: { x: 5, y: 5 } })).toBeNull()
  })
})
