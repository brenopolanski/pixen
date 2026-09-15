import { PixenError } from '@/lib/errors'
import type { Box, Point, Size } from '@/lib/image/pixelize'
import { displayedImageRect } from '@/lib/image/pixelize'

/**
 * Default shaft thickness in image pixels. The head scales from this so a
 * thicker stroke does not leave a tiny tip on a fat line.
 */
export const ARROW_STROKE = 8

/** How long the head is, relative to the shaft. 8 → 22, matching the old fixed tip. */
const HEAD_LENGTH_RATIO = 2.75

/** How wide the head is, relative to the shaft. 8 → 20. */
const HEAD_WIDTH_RATIO = 2.5

export const arrowHeadLength = (stroke = ARROW_STROKE): number => stroke * HEAD_LENGTH_RATIO

export const arrowHeadWidth = (stroke = ARROW_STROKE): number => stroke * HEAD_WIDTH_RATIO

/**
 * Below this (at the default stroke) an arrow is all head and reads as a
 * smudge rather than as a direction, so a drag that short is treated as a
 * slip of the mouse.
 */
export const MIN_ARROW_LENGTH = arrowHeadLength()

/** The step badges' red, so the two annotation tools look like one kit. */
export const ARROW_COLOR = '#e5484d'

export const arrowColor = (arrow: Arrow): string => arrow.color ?? ARROW_COLOR

export const arrowStroke = (arrow: Arrow): number => arrow.stroke ?? ARROW_STROKE

/** An arrow the user has drawn, tail to tip, in image pixels. */
export interface Arrow {
  /** Where the drag started; the blunt end. */
  from: Point
  /** Where the drag ended; the end that carries the head. */
  to: Point
  /** Overrides `ARROW_COLOR` for this arrow. */
  color?: string
  /** Overrides `ARROW_STROKE` for this arrow. */
  stroke?: number
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
  return arrowLength(arrow) >= arrowHeadLength(arrowStroke(arrow))
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
  const stroke = arrowStroke(arrow)
  const head = Math.min(arrowHeadLength(stroke), length)
  const halfWidth = arrowHeadWidth(stroke) / 2

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

/** Extra pixels around the shaft so a thin arrow is still easy to click. */
const HIT_SLOP = 12

const distanceToSegment = (point: Point, start: Point, end: Point): number => {
  const dx = end.x - start.x
  const dy = end.y - start.y
  const lengthSq = dx * dx + dy * dy

  if (lengthSq === 0) {
    return Math.hypot(point.x - start.x, point.y - start.y)
  }

  const t = clamp(((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSq, 0, 1)

  return Math.hypot(point.x - (start.x + t * dx), point.y - (start.y + t * dy))
}

const pointInTriangle = (point: Point, a: Point, b: Point, c: Point): boolean => {
  const v0x = c.x - a.x
  const v0y = c.y - a.y
  const v1x = b.x - a.x
  const v1y = b.y - a.y
  const v2x = point.x - a.x
  const v2y = point.y - a.y
  const dot00 = v0x * v0x + v0y * v0y
  const dot01 = v0x * v1x + v0y * v1y
  const dot02 = v0x * v2x + v0y * v2y
  const dot11 = v1x * v1x + v1y * v1y
  const dot12 = v1x * v2x + v1y * v2y
  const denom = dot00 * dot11 - dot01 * dot01

  if (denom === 0) {
    return false
  }

  const u = (dot11 * dot02 - dot01 * dot12) / denom
  const v = (dot00 * dot12 - dot01 * dot02) / denom

  return u >= 0 && v >= 0 && u + v <= 1
}

const hitsArrow = (arrow: Arrow, point: Point): boolean => {
  const outline = arrowOutline(arrow)

  if (!outline) {
    return false
  }

  const slop = Math.max(arrowStroke(arrow), HIT_SLOP)

  if (distanceToSegment(point, arrow.from, outline.shaftEnd) <= slop) {
    return true
  }

  return pointInTriangle(point, arrow.to, outline.left, outline.right)
}

/**
 * Which arrow the pointer is on, or null. Later arrows sit on top, so the walk
 * is backwards: the last drawn one that covers the point wins.
 */
export const hitTestArrow = (arrows: readonly Arrow[], point: Point): number | null => {
  for (let index = arrows.length - 1; index >= 0; index -= 1) {
    const arrow = arrows[index]

    if (arrow && hitsArrow(arrow, point)) {
      return index
    }
  }

  return null
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
  context.lineCap = 'round'

  for (const arrow of arrows) {
    const outline = arrowOutline(arrow)

    if (!outline) {
      continue
    }

    const color = arrowColor(arrow)

    context.fillStyle = color
    context.strokeStyle = color
    context.lineWidth = arrowStroke(arrow)

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
