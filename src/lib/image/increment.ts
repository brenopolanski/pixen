import { PixenError } from '@/lib/errors'
import type { Point, Rect, Size } from '@/lib/image/pixelize'

/**
 * Badge width in image pixels. Fixed rather than a setting: Shutter's tool has
 * one size too, and a screenshot at normal scale gives two digits room to
 * breathe at this diameter.
 */
export const BADGE_DIAMETER = 48

/** Where the counter starts each time the tool is opened. */
export const FIRST_STEP = 1

/** A number the user has dropped, in image pixels. */
export interface Stamp {
  /** The digit shown, counting up from `FIRST_STEP`. */
  step: number
  /** The point clicked, which the badge is centred on. */
  x: number
  y: number
}

const BADGE_FILL = '#e5484d'
const BADGE_TEXT = '#ffffff'

const clamp = (value: number, min: number, max: number): number => {
  return Math.min(Math.max(value, min), max)
}

/**
 * The box a badge occupies, centred on the click and nudged to stay on the
 * image, so a number dropped near an edge is not sliced in half.
 *
 * The diameter itself is never shrunk: a smaller badge at the edge would look
 * like a different tool rather than the same one, moved.
 */
export const badgeRect = (image: Size, stamp: Point): Rect => {
  const diameter = Math.min(BADGE_DIAMETER, image.width, image.height)
  const radius = diameter / 2

  return {
    x: clamp(stamp.x - radius, 0, Math.max(image.width - diameter, 0)),
    y: clamp(stamp.y - radius, 0, Math.max(image.height - diameter, 0)),
    width: diameter,
    height: diameter,
  }
}

const loadImage = (dataUrl: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const image = new Image()

    image.onload = () => resolve(image)
    image.onerror = () => reject(new PixenError('Pixen could not read the image to number it.'))
    image.src = dataUrl
  })
}

/**
 * Draws the badges onto the image and hands the result back as a PNG data URL.
 *
 * A canvas rather than Rust, unlike the pixelize mosaic: a badge needs a font
 * to draw a digit, and the webview already has one. PNG so alpha survives —
 * this is an edit passing through memory, not a save, so the toolbar's format
 * has no say in it.
 */
export const composeStamps = async (dataUrl: string, stamps: Stamp[]): Promise<string> => {
  const source = await loadImage(dataUrl)
  const canvas = document.createElement('canvas')

  canvas.width = source.naturalWidth
  canvas.height = source.naturalHeight

  const context = canvas.getContext('2d')

  if (!context) {
    throw new PixenError('Pixen could not draw the numbers onto this image.')
  }

  context.drawImage(source, 0, 0)

  const size = { width: canvas.width, height: canvas.height }

  for (const stamp of stamps) {
    const rect = badgeRect(size, stamp)
    const radius = rect.width / 2
    const centerX = rect.x + radius
    const centerY = rect.y + radius

    context.beginPath()
    context.arc(centerX, centerY, radius, 0, Math.PI * 2)
    context.fillStyle = BADGE_FILL
    context.fill()

    context.fillStyle = BADGE_TEXT
    // Scaled off the badge rather than fixed, so a badge shrunk to fit a tiny
    // image keeps its digit inside the circle.
    context.font = `600 ${Math.round(rect.height * 0.58)}px system-ui, sans-serif`
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.fillText(String(stamp.step), centerX, centerY)
  }

  return canvas.toDataURL('image/png')
}
