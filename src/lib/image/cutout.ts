import { removeBackground } from '@imgly/background-removal'

import { PixenError } from '@/lib/errors'

/**
 * Where `pnpm assets:bg-removal` puts the model, relative to the document. The
 * trailing slash keeps the resource names from landing on the parent directory.
 */
const PUBLIC_DIRECTORY = 'bg-removal/'

/**
 * The library uses `publicPath` as a base for `new URL`, which rejects a bare
 * path, so it has to be absolute. Resolved against the document rather than
 * built from the origin because Tauri serves the app over `tauri://` in a
 * release build, and a non-HTTP scheme has no origin worth concatenating.
 */
const publicPath = (): string => new URL(PUBLIC_DIRECTORY, window.location.href).href

/**
 * The quantized ISNet, ~44 MB. Plenty for the screenshots Pixen is pointed at;
 * `isnet_fp16` is the same model at twice the size if edges ever need it.
 * Changing this means changing RESOURCES in scripts/fetch-bg-removal-assets.mjs.
 */
const MODEL = 'isnet_quint8'

const MISSING_ASSETS_MESSAGE =
  'The background removal model is not installed. Run pnpm assets:bg-removal, then try again.'

/**
 * Fails early when `pnpm assets:bg-removal` has not been run.
 *
 * Checked here rather than by reading the library's own failure, because that
 * failure is not recognisable: a dev server answers a missing file with
 * `index.html` instead of a 404, so the library reports a JSON parse error
 * somewhere inside itself. Parsing the manifest is what tells the two apart.
 *
 * Falling back to IMG.LY's CDN is deliberately not an option — it would breach
 * the CSP and send the image somewhere the user never agreed to.
 */
const assertAssetsPresent = async (base: string): Promise<void> => {
  try {
    const response = await fetch(new URL('resources.json', base))

    if (!response.ok) {
      throw new Error(`resources.json responded ${response.status}`)
    }

    await response.json()
  } catch {
    throw new PixenError(MISSING_ASSETS_MESSAGE)
  }
}

/** How far along the model is, as a fraction, for the overlay to render. */
export type CutoutProgress = (ratio: number) => void

/**
 * Data URL rather than Blob: the session stores images as data URLs, so a
 * cutout has to arrive in the same shape as anything else the editor loads.
 */
export const blobToDataUrl = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = () => {
      const { result } = reader

      if (typeof result === 'string') {
        resolve(result)
        return
      }

      reject(new PixenError('Could not read the processed image.'))
    }

    reader.onerror = () => {
      reject(new PixenError('Could not read the processed image.'))
    }

    reader.readAsDataURL(blob)
  })
}

/**
 * The library reports progress per resource with byte counts, which for a model
 * split into 4 MB chunks means the bar restarts a dozen times. Summing the
 * chunks instead gives one number that only ever goes up.
 */
const progressReporter = (onProgress: CutoutProgress) => {
  const totals = new Map<string, { done: number; size: number }>()

  return (key: string, done: number, size: number) => {
    totals.set(key, { done, size })

    let doneSum = 0
    let sizeSum = 0

    for (const entry of totals.values()) {
      doneSum += entry.done
      sizeSum += entry.size
    }

    if (sizeSum > 0) {
      onProgress(Math.min(doneSum / sizeSum, 1))
    }
  }
}

/**
 * Runs the segmentation model over an image and returns it with the background
 * gone. Everything is local: the model is served from `public/`, inference is
 * WASM in this process, and the image is never uploaded.
 *
 * PNG out, because the cutout is nothing but alpha — a JPEG would fill the
 * transparency back in with black.
 */
export const removeImageBackground = async (
  dataUrl: string,
  onProgress: CutoutProgress,
): Promise<string> => {
  const base = publicPath()

  await assertAssetsPresent(base)

  const blob = await removeBackground(dataUrl, {
    publicPath: base,
    model: MODEL,
    output: { format: 'image/png' },
    progress: progressReporter(onProgress),
  })

  return blobToDataUrl(blob)
}
