import { PixenError } from '@/lib/errors'
import type { Point, Rect, Size } from '@/lib/image/pixelize'

/**
 * Default badge width in image pixels. A screenshot at normal scale gives two
 * digits room to breathe at this diameter; the overlay slider can go smaller
 * or larger per stamp.
 */
export const BADGE_DIAMETER = 48

/** Smallest the overlay slider will go. */
export const BADGE_DIAMETER_MIN = 32

/** Largest the overlay slider will go. */
export const BADGE_DIAMETER_MAX = 72

/** Where the counter starts each time the tool is opened. */
export const FIRST_STEP = 1

/** Fill used when a stamp does not set its own colour. Same red as the arrows. */
export const BADGE_COLOR = '#e5484d'

const BADGE_TEXT_ON_DARK = '#ffffff'
const BADGE_TEXT_ON_LIGHT = '#111111'

/** A number the user has dropped, in image pixels. */
export interface Stamp {
  /** The digit shown, counting up from `FIRST_STEP`. */
  step: number
  /** The point clicked, which the badge is centred on. */
  x: number
  y: number
  /** Overrides `BADGE_COLOR` for this stamp. */
  color?: string
  /** Overrides `BADGE_DIAMETER` for this stamp. */
  diameter?: number
}

const clamp = (value: number, min: number, max: number): number => {
  return Math.min(Math.max(value, min), max)
}

export const badgeColor = (stamp: Pick<Stamp, 'color'>): string => stamp.color ?? BADGE_COLOR

export const stampDiameter = (stamp: Pick<Stamp, 'diameter'>): number =>
  stamp.diameter ?? BADGE_DIAMETER

/**
 * White digits on a dark fill, dark digits on a light one, so the yellow and
 * white swatches stay readable.
 */
export const badgeTextColor = (fill: string): string => {
  const hex = fill.trim().replace(/^#/, '')
  const normalized = hex.length === 3 ? [...hex].map((channel) => channel + channel).join('') : hex

  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) {
    return BADGE_TEXT_ON_DARK
  }

  const value = Number.parseInt(normalized, 16)
  const channel = (shift: number) => {
    const srgb = ((value >> shift) & 255) / 255

    return srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4
  }

  const luminance = 0.2126 * channel(16) + 0.7152 * channel(8) + 0.0722 * channel(0)

  return luminance > 0.55 ? BADGE_TEXT_ON_LIGHT : BADGE_TEXT_ON_DARK
}

/**
 * The box a badge occupies, centred on the click and nudged to stay on the
 * image, so a number dropped near an edge is not sliced in half.
 *
 * The diameter itself is never shrunk to dodge an edge: a smaller badge there
 * would look like a different tool rather than the same one, moved. A picture
 * smaller than the badge is the exception — then the circle is min'd so it
 * still fits.
 */
export const badgeRect = (image: Size, stamp: Pick<Stamp, 'x' | 'y' | 'diameter'>): Rect => {
  const diameter = Math.min(stampDiameter(stamp), image.width, image.height)
  const radius = diameter / 2

  return {
    x: clamp(stamp.x - radius, 0, Math.max(image.width - diameter, 0)),
    y: clamp(stamp.y - radius, 0, Math.max(image.height - diameter, 0)),
    width: diameter,
    height: diameter,
  }
}

const circleOf = (image: Size, stamp: Pick<Stamp, 'x' | 'y' | 'diameter'>) => {
  const rect = badgeRect(image, stamp)
  const radius = rect.width / 2

  return { x: rect.x + radius, y: rect.y + radius, radius }
}

/**
 * Which badge the pointer is on, or null. Later stamps sit on top, so the walk
 * is backwards: the last dropped one that covers the point wins.
 */
export const hitTestStamp = (
  stamps: readonly Stamp[],
  point: Point,
  image: Size,
): number | null => {
  for (let index = stamps.length - 1; index >= 0; index -= 1) {
    const stamp = stamps[index]

    if (!stamp) {
      continue
    }

    const circle = circleOf(image, stamp)

    if (Math.hypot(point.x - circle.x, point.y - circle.y) <= circle.radius) {
      return index
    }
  }

  return null
}

/**
 * Slides a badge without changing its size. The delta is shrunk so the circle
 * stays fully on the image instead of hanging off the rim.
 */
export const translateStamp = (stamp: Stamp, delta: Point, image: Size): Stamp => {
  const circle = circleOf(image, stamp)
  const minX = circle.radius
  const maxX = Math.max(image.width - circle.radius, minX)
  const minY = circle.radius
  const maxY = Math.max(image.height - circle.radius, minY)
  const x = clamp(circle.x + delta.x, minX, maxX)
  const y = clamp(circle.y + delta.y, minY, maxY)

  return {
    ...stamp,
    x: Math.round(x),
    y: Math.round(y),
  }
}

/** Rewrites `step` to `1…n` so deleting a number does not leave a hole. */
export const renumberStamps = (stamps: readonly Stamp[]): Stamp[] => {
  return stamps.map((stamp, index) => ({ ...stamp, step: FIRST_STEP + index }))
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
 * A canvas rather than Rust, unlike pixelation: a badge needs a font
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
    const fill = badgeColor(stamp)

    context.beginPath()
    context.arc(centerX, centerY, radius, 0, Math.PI * 2)
    context.fillStyle = fill
    context.fill()

    context.fillStyle = badgeTextColor(fill)
    // Scaled off the badge rather than fixed, so a badge shrunk to fit a tiny
    // image keeps its digit inside the circle.
    context.font = `600 ${Math.round(rect.height * 0.58)}px system-ui, sans-serif`
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.fillText(String(stamp.step), centerX, centerY)
  }

  return canvas.toDataURL('image/png')
}
