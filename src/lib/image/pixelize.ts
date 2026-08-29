import { invoke } from '@tauri-apps/api/core'

/**
 * A rectangle smaller than this on the image is treated as a stray click. Below
 * a couple of mosaic blocks there is nothing left to hide anyway.
 */
export const MIN_PIXELIZE_SIDE = 4

/** A box in CSS pixels, as the overlay measures itself. */
export interface Box {
  width: number
  height: number
}

export interface Size {
  width: number
  height: number
}

/** A rectangle in the coordinate space of whatever produced it. */
export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

/** A point in the coordinate space of whatever produced it. */
export interface Point {
  x: number
  y: number
}

/**
 * Where a `contain`-fitted image actually lands inside its box.
 *
 * The overlay shows the whole image scaled down to fit, which leaves a margin
 * on one axis. Selections have to be measured against this rect rather than the
 * box, or everything drifts by half the letterbox.
 */
export const displayedImageRect = (box: Box, image: Size): Rect => {
  if (box.width <= 0 || box.height <= 0 || image.width <= 0 || image.height <= 0) {
    return { x: 0, y: 0, width: 0, height: 0 }
  }

  // Never above 1: the image is fitted, not blown up, so its own pixels stay
  // the ceiling and a small image is not resampled into blur.
  const scale = Math.min(box.width / image.width, box.height / image.height, 1)
  const width = image.width * scale
  const height = image.height * scale

  return {
    x: (box.width - width) / 2,
    y: (box.height - height) / 2,
    width,
    height,
  }
}

const clamp = (value: number, min: number, max: number): number => {
  return Math.min(Math.max(value, min), max)
}

/**
 * Turns a drag on the overlay into whole pixels on the image.
 *
 * Null when the drag has no useful overlap: entirely in the letterbox margin,
 * or too small to be anything but a slip of the mouse. The caller treats that
 * as a cancel rather than an error.
 */
export const selectionToPixels = (box: Box, image: Size, selection: Rect): Rect | null => {
  const displayed = displayedImageRect(box, image)

  if (displayed.width <= 0 || displayed.height <= 0) {
    return null
  }

  // Clamped into the displayed image first, so a drag that starts in the margin
  // still hides the part of it that landed on the picture.
  const left = clamp(selection.x, displayed.x, displayed.x + displayed.width)
  const top = clamp(selection.y, displayed.y, displayed.y + displayed.height)
  const right = clamp(selection.x + selection.width, displayed.x, displayed.x + displayed.width)
  const bottom = clamp(selection.y + selection.height, displayed.y, displayed.y + displayed.height)

  const scale = image.width / displayed.width

  // Floor the origin and ceil the far edge so the mosaic always covers every
  // pixel the user dragged over, never a row less.
  const x = Math.floor((left - displayed.x) * scale)
  const y = Math.floor((top - displayed.y) * scale)
  const width = Math.min(Math.ceil((right - displayed.x) * scale), image.width) - x
  const height = Math.min(Math.ceil((bottom - displayed.y) * scale), image.height) - y

  if (width < MIN_PIXELIZE_SIDE || height < MIN_PIXELIZE_SIDE) {
    return null
  }

  return { x, y, width, height }
}

/**
 * Turns a click on the overlay into a pixel on the image.
 *
 * Null in the letterbox margin. A tool that stamps rather than selects stays
 * open on a miss, so this reports the miss instead of clamping the click onto
 * the nearest edge, where the user did not aim.
 */
export const clickToPixel = (box: Box, image: Size, point: Point): Point | null => {
  const displayed = displayedImageRect(box, image)

  if (displayed.width <= 0 || displayed.height <= 0) {
    return null
  }

  const offsetX = point.x - displayed.x
  const offsetY = point.y - displayed.y

  if (offsetX < 0 || offsetY < 0 || offsetX > displayed.width || offsetY > displayed.height) {
    return null
  }

  const scale = image.width / displayed.width

  return {
    x: Math.min(Math.floor(offsetX * scale), image.width - 1),
    y: Math.min(Math.floor(offsetY * scale), image.height - 1),
  }
}

/**
 * The inverse: where a pixel on the image shows up on the overlay.
 *
 * What keeps a stamp drawn in CSS over the same pixel it will be baked onto.
 */
export const pixelToDisplayed = (box: Box, image: Size, point: Point): Point => {
  const displayed = displayedImageRect(box, image)

  if (displayed.width <= 0 || displayed.height <= 0) {
    return { x: 0, y: 0 }
  }

  const scale = displayed.width / image.width

  return {
    x: displayed.x + point.x * scale,
    y: displayed.y + point.y * scale,
  }
}

/** How much smaller the image is on screen than in its own pixels. */
export const displayedScale = (box: Box, image: Size): number => {
  const displayed = displayedImageRect(box, image)

  return displayed.width <= 0 ? 0 : displayed.width / image.width
}

/** Normalises a drag into a positive rectangle, whichever way it was drawn. */
export const rectBetween = (from: { x: number; y: number }, to: { x: number; y: number }): Rect => {
  return {
    x: Math.min(from.x, to.x),
    y: Math.min(from.y, to.y),
    width: Math.abs(to.x - from.x),
    height: Math.abs(to.y - from.y),
  }
}

/**
 * Replaces a region with a mosaic and returns the whole image again.
 *
 * PNG in, PNG out: this is an edit passing through memory on its way back to
 * the editor, so the toolbar's save format has no say in it.
 */
export const pixelizeImage = (dataUrl: string, region: Rect): Promise<string> => {
  return invoke('pixelize_image', { dataUrl, ...region })
}
