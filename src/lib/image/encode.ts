import { PixenError } from '@/lib/errors'
import type { SaveFormat } from '@/lib/image/image'

/** Matches the quality the editor itself uses for lossy exports. */
const LOSSY_QUALITY = 0.92

const mimeTypeOf = (dataUrl: string): string => {
  return /^data:([^;,]+)/.exec(dataUrl)?.[1] ?? ''
}

const decode = (dataUrl: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const image = new Image()

    image.addEventListener('load', () => resolve(image), { once: true })
    image.addEventListener(
      'error',
      () => reject(new PixenError('Pixen could not read the edited image.')),
      { once: true },
    )

    image.src = dataUrl
  })
}

/**
 * Re-encodes the editor's output into the format the destination asks for.
 *
 * This is not an optimisation: `getImage()` returns the loaded source data URL
 * verbatim while the canvas holds no objects, so an opened JPEG comes back as
 * JPEG and would otherwise be written behind a `.png` name.
 */
export const encodeImage = async (dataUrl: string, format: SaveFormat): Promise<string> => {
  if (mimeTypeOf(dataUrl) === format.mimeType) {
    return dataUrl
  }

  const image = await decode(dataUrl)
  const canvas = document.createElement('canvas')

  canvas.width = image.naturalWidth
  canvas.height = image.naturalHeight

  const context = canvas.getContext('2d')

  if (!context) {
    throw new PixenError('Pixen could not prepare the image for saving.')
  }

  // JPEG carries no alpha channel, so anything transparent would encode black.
  if (format.mimeType === 'image/jpeg') {
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, canvas.width, canvas.height)
  }

  context.drawImage(image, 0, 0)

  const encoded = canvas.toDataURL(format.mimeType, LOSSY_QUALITY)

  // A format the webview cannot encode falls back to PNG silently, which would
  // put PNG bytes behind the extension the user picked.
  if (mimeTypeOf(encoded) !== format.mimeType) {
    throw new PixenError(`This system cannot save ${format.name} images.`)
  }

  return encoded
}
