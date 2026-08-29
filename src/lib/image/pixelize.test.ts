import { describe, expect, it } from 'vitest'

import {
  clickToPixel,
  displayedImageRect,
  displayedScale,
  pixelToDisplayed,
  rectBetween,
  selectionToPixels,
} from './pixelize'

describe('displayedImageRect', () => {
  it('letterboxes a wide image that has to shrink to fit', () => {
    expect(displayedImageRect({ width: 400, height: 400 }, { width: 800, height: 400 })).toEqual({
      x: 0,
      y: 100,
      width: 400,
      height: 200,
    })
  })

  it('leaves a small image at its own size rather than upscaling it', () => {
    expect(displayedImageRect({ width: 400, height: 400 }, { width: 100, height: 50 })).toEqual({
      x: 150,
      y: 175,
      width: 100,
      height: 50,
    })
  })

  it('collapses when there is nothing to measure against', () => {
    expect(displayedImageRect({ width: 0, height: 0 }, { width: 200, height: 100 })).toEqual({
      x: 0,
      y: 0,
      width: 0,
      height: 0,
    })
  })
})

describe('selectionToPixels', () => {
  const box = { width: 400, height: 400 }
  // Displayed at 400x200, offset 100 from the top, so one CSS pixel is two
  // image pixels.
  const image = { width: 800, height: 400 }

  it('scales a selection on the image up to whole pixels', () => {
    expect(selectionToPixels(box, image, { x: 100, y: 150, width: 50, height: 25 })).toEqual({
      x: 200,
      y: 100,
      width: 100,
      height: 50,
    })
  })

  it('keeps only the part of a drag that landed on the image', () => {
    // Starts 50px above the letterboxed image and ends 50px into it.
    expect(selectionToPixels(box, image, { x: 0, y: 50, width: 40, height: 100 })).toEqual({
      x: 0,
      y: 0,
      width: 80,
      height: 100,
    })
  })

  it('refuses a drag that never touched the image', () => {
    expect(selectionToPixels(box, image, { x: 10, y: 10, width: 30, height: 30 })).toBeNull()
  })

  it('refuses a slip of the mouse', () => {
    expect(selectionToPixels(box, image, { x: 100, y: 150, width: 1, height: 1 })).toBeNull()
  })
})

describe('clickToPixel', () => {
  const box = { width: 400, height: 400 }
  // Displayed at 400x200, offset 100 from the top: one CSS pixel is two image
  // pixels.
  const image = { width: 800, height: 400 }

  it('scales a click on the image up to a pixel', () => {
    expect(clickToPixel(box, image, { x: 100, y: 150 })).toEqual({ x: 200, y: 100 })
  })

  it('refuses a click in the letterbox margin', () => {
    expect(clickToPixel(box, image, { x: 100, y: 40 })).toBeNull()
    expect(clickToPixel(box, image, { x: 100, y: 360 })).toBeNull()
  })

  it('keeps a click on the far edge inside the image', () => {
    expect(clickToPixel(box, image, { x: 400, y: 300 })).toEqual({ x: 799, y: 399 })
  })
})

describe('pixelToDisplayed', () => {
  const box = { width: 400, height: 400 }
  const image = { width: 800, height: 400 }

  it('places a pixel back where it is shown', () => {
    expect(pixelToDisplayed(box, image, { x: 200, y: 100 })).toEqual({ x: 100, y: 150 })
  })

  it('inverts clickToPixel', () => {
    const point = { x: 137, y: 211 }
    const pixel = clickToPixel(box, image, point)

    expect(pixel).not.toBeNull()

    const back = pixelToDisplayed(box, image, pixel!)

    // Within a CSS pixel: the pixel coordinate is floored on the way in, so the
    // round trip lands on the top-left of the pixel that was clicked.
    expect(Math.abs(back.x - point.x)).toBeLessThanOrEqual(1)
    expect(Math.abs(back.y - point.y)).toBeLessThanOrEqual(1)
  })
})

describe('displayedScale', () => {
  it('reports how much the image shrank to fit', () => {
    expect(displayedScale({ width: 400, height: 400 }, { width: 800, height: 400 })).toBe(0.5)
  })

  it('is 1 for an image that fits already', () => {
    expect(displayedScale({ width: 400, height: 400 }, { width: 100, height: 50 })).toBe(1)
  })
})

describe('rectBetween', () => {
  it('normalises a drag drawn up and to the left', () => {
    expect(rectBetween({ x: 90, y: 80 }, { x: 40, y: 30 })).toEqual({
      x: 40,
      y: 30,
      width: 50,
      height: 50,
    })
  })
})
