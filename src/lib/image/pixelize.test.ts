import { describe, expect, it } from 'vitest'

import { displayedImageRect, rectBetween, selectionToPixels } from './pixelize'

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
