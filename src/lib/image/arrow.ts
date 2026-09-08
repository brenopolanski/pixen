import { PixenError } from '@/lib/errors'
import type { Box, Point, Size } from '@/lib/image/pixelize'
import { displayedImageRect } from '@/lib/image/pixelize'

/**
 * Arrow metrics in image pixels. Fixed rather than settings, for the same
 * reason the step badges are: a guide wants its arrows to match each other more
 * than it wants them adjustable.
 */
export const ARROW_STROKE = 8
const ARROW_HEAD_LENGTH = 22
const ARROW_HEAD_WIDTH = 20

/**
 * Below this an arrow is all head and reads as a smudge rather than as a
 * direction, so a drag that short is treated as a slip of the mouse.
 */
export const MIN_ARROW_LENGTH = ARROW_HEAD_LENGTH

/** The step badges' red, so the two annotation tools look like one kit. */
export const ARROW_COLOR = '#e5484d'

/** An arrow the user has drawn, tail to tip, in image pixels. */
export interface Arrow {
  /** Where the drag started; the blunt end. */
  from: Point
  /** Where the drag ended; the end that carries the head. */
  to: Point
}

const clamp = (value: number, min: number, max: number): number => {
  return Math.min(Math.max(value, min), max)
}

/**
 * Where a point on the overlay lands on the image, pulled onto the picture when
 * it falls in the letterbox margin.
 *
 * `clickToPixel` reports a miss instead, which is what the stamping tools want.
 * An arrow is dragged rather than clicked, and dragging past the edge is how
 * you point at something on the rim, so the tip is clamped rather than refused.
 */
export const clampPixel = (box: Box, image: Size, point: Point): Point => {
  const displayed = displayedImageRect(box, image)

  if (displayed.width <= 0 || displayed.height <= 0) {
    return { x: 0, y: 0 }
  }

  const scale = image.width / displayed.width

  return {
    x: clamp(Math.round((point.x - displayed.x) * scale), 0, Math.max(image.width - 1, 0)),
    y: clamp(Math.round((point.y - displayed.y) * scale), 0, Math.max(image.height - 1, 0)),
  }
}

/** How long the arrow is, in image pixels. */
export const arrowLength = (arrow: Arrow): number => {
  return Math.hypot(arrow.to.x - arrow.from.x, arrow.to.y - arrow.from.y)
}

/** Whether the drag is long enough to be worth keeping. */
export const isUsableArrow = (arrow: Arrow): boolean => {
  return arrowLength(arrow) >= MIN_ARROW_LENGTH
}

/**
 * The three points the head is drawn from, and where the shaft has to stop so
 * it does not poke out of the tip.
 *
 * Shared by the overlay's preview and the composite, so an arrow is baked
 * exactly as it was shown.
 */
export const arrowOutline = (
  arrow: Arrow,
): { shaftEnd: Point; left: Point; right: Point } | null => {
  const length = arrowLength(arrow)

  if (length <= 0) {
    return null
  }

  const unitX = (arrow.to.x - arrow.from.x) / length
  const unitY = (arrow.to.y - arrow.from.y) / length
  const head = Math.min(ARROW_HEAD_LENGTH, length)
  const halfWidth = ARROW_HEAD_WIDTH / 2

  const shaftEnd = {
    x: arrow.to.x - unitX * head,
    y: arrow.to.y - unitY * head,
  }

  return {
    shaftEnd,
    left: { x: shaftEnd.x - unitY * halfWidth, y: shaftEnd.y + unitX * halfWidth },
    right: { x: shaftEnd.x + unitY * halfWidth, y: shaftEnd.y - unitX * halfWidth },
  }
}

const loadImage = (dataUrl: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const image = new Image()

    image.onload = () => resolve(image)
    image.onerror = () =>
      reject(new PixenError('Pixen could not read the image to draw the arrows on it.'))
    image.src = dataUrl
  })
}

/**
 * Draws the arrows onto the image and hands the result back as a PNG data URL.
 *
 * A canvas rather than Rust, the same call the step badges make: the shapes are
 * cheap to draw here and the result is an edit passing through memory, not a
 * save, so the toolbar's format has no say in it.
 */
export const composeArrows = async (dataUrl: string, arrows: Arrow[]): Promise<string> => {
  const source = await loadImage(dataUrl)
  const canvas = document.createElement('canvas')

  canvas.width = source.naturalWidth
  canvas.height = source.naturalHeight

  const context = canvas.getContext('2d')

  if (!context) {
    throw new PixenError('Pixen could not draw the arrows onto this image.')
  }

  context.drawImage(source, 0, 0)

  context.fillStyle = ARROW_COLOR
  context.strokeStyle = ARROW_COLOR
  context.lineWidth = ARROW_STROKE
  context.lineCap = 'round'

  for (const arrow of arrows) {
    const outline = arrowOutline(arrow)

    if (!outline) {
      continue
    }

    context.beginPath()
    context.moveTo(arrow.from.x, arrow.from.y)
    context.lineTo(outline.shaftEnd.x, outline.shaftEnd.y)
    context.stroke()

    context.beginPath()
    context.moveTo(arrow.to.x, arrow.to.y)
    context.lineTo(outline.left.x, outline.left.y)
    context.lineTo(outline.right.x, outline.right.y)
    context.closePath()
    context.fill()
  }

  return canvas.toDataURL('image/png')
}
