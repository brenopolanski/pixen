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
 * The library memoizes a single ONNX session for the whole process, and the
 * runtime will not take two `run` calls on it at once. Cancelling the overlay
 * cannot abort the inference already in WASM, so the next open has to wait its
 * turn instead of starting alongside it — an overlapped run comes back as an
 * empty mask, which is a fully transparent PNG where the photo used to be.
 */
let queue: Promise<unknown> = Promise.resolve()

/** Diagnostic only. The overlay still shows the generic sentence. */
const logBackgroundRemovalFailure = (base: string, error: unknown): void => {
  const properties =
    error !== null && typeof error === 'object'
      ? Object.fromEntries(
          Object.getOwnPropertyNames(error).map((key) => [key, Reflect.get(error, key)]),
        )
      : undefined

  console.error('[Pixen] Background removal failed:', error)
  console.error('[Pixen] Background removal error details:', {
    error,
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    properties,
    publicPath: base,
    model: MODEL,
    dev: import.meta.env.DEV,
  })
}

/**
 * TEMPORARY TestFlight instrumentation. Remove once we know whether the
 * WebView can fetch the vendored IMG.LY chunks. These hashes are the CPU WASM
 * and MJS chunks named by resources.json; a failure here is only logged.
 */
const WASM_CHUNK = '3dae4038fc722ce4ce041fbc9c63fd5c2d9864bc732a01994518f96e9ec2f357'
const MJS_CHUNK = 'aa485cf3fa61ca007b3e1ca7b65068328270f072b61cdda490b732211e1da5d9'

/** TEMPORARY. One fetched resource, shown in the diagnostic panel. */
export interface ResourceProbe {
  url: string
  status: number | null
  ok: boolean | null
  contentType: string | null
  blobSize: number | null
  error: string | null
}

const logResourceProbe = async (
  base: string,
  name: string,
  readBody: boolean,
): Promise<ResourceProbe> => {
  const url = new URL(name, base).href

  try {
    const response = await fetch(url)
    const probe: ResourceProbe = {
      url,
      status: response.status,
      ok: response.ok,
      contentType: response.headers.get('content-type'),
      blobSize: readBody ? (await response.blob()).size : null,
      error: null,
    }

    console.error('[Pixen] Background removal diagnostic', {
      name,
      url: probe.url,
      status: probe.status,
      ok: probe.ok,
      contentType: probe.contentType,
      contentLength: response.headers.get('content-length'),
      ...(readBody ? { blobSize: probe.blobSize } : {}),
    })

    return probe
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)

    console.error('[Pixen] Background removal diagnostic', { name, url, message, error })

    return { url, status: null, ok: null, contentType: null, blobSize: null, error: message }
  }
}

/** TEMPORARY. The panel reads this; closing it does not stop the cutout. */
export interface CutoutDiagnostic {
  publicPath: string
  resourcesJsonUrl: string
  resources: ResourceProbe | null
  wasm: ResourceProbe | null
  mjs: ResourceProbe | null
  result: 'Idle' | 'Running' | 'Success' | 'Failed'
  message: string | null
  stack: string | null
}

let diagnostic: CutoutDiagnostic | null = null
// The panel opens only from ⌘⇧D0. Probes update this store either way.
let diagnosticHidden = true
const diagnosticListeners = new Set<() => void>()

const emitDiagnostic = (): void => {
  for (const listener of diagnosticListeners) {
    listener()
  }
}

const publishDiagnostic = (next: CutoutDiagnostic): void => {
  diagnostic = next
  emitDiagnostic()
}

const patchDiagnostic = (partial: Partial<CutoutDiagnostic>): void => {
  if (!diagnostic) {
    return
  }

  diagnostic = { ...diagnostic, ...partial }
  emitDiagnostic()
}

/** Shows the panel. A removal in progress keeps updating it; opening does not start one. */
export const openCutoutDiagnostic = (): void => {
  diagnosticHidden = false

  if (!diagnostic) {
    const base = publicPath()

    diagnostic = {
      publicPath: base,
      resourcesJsonUrl: new URL('resources.json', base).href,
      resources: null,
      wasm: null,
      mjs: null,
      result: 'Idle',
      message: null,
      stack: null,
    }
  }

  emitDiagnostic()
}

const probeLine = (label: string, probe: ResourceProbe | null): string[] => {
  if (!probe) {
    return [`${label}: not checked`]
  }

  return [
    `${label} URL: ${probe.url}`,
    `${label} HTTP status: ${probe.status ?? '—'}`,
    `${label} ok: ${probe.ok ?? '—'}`,
    `${label} Content-Type: ${probe.contentType ?? '—'}`,
    `${label} Blob size: ${probe.blobSize ?? '—'}`,
    `${label} error: ${probe.error ?? '—'}`,
  ]
}

/** Plain text for the clipboard. The panel renders the same fields. */
export const formatCutoutDiagnostic = (
  current: CutoutDiagnostic,
  app: { version: string; runtime: string },
): string => {
  return [
    'Pixen diagnostics',
    `App version: ${app.version}`,
    `Runtime: ${app.runtime}`,
    `Public Path: ${current.publicPath}`,
    `resources.json URL: ${current.resourcesJsonUrl}`,
    ...probeLine('resources.json', current.resources),
    ...probeLine('WASM chunk', current.wasm),
    ...probeLine('MJS chunk', current.mjs),
    `Background removal: ${current.result}`,
    `Last error: ${current.message ?? '—'}`,
    `Stack: ${current.stack ?? '—'}`,
  ].join('\n')
}

export const dismissCutoutDiagnostic = (): void => {
  diagnosticHidden = true
  emitDiagnostic()
}

export const subscribeCutoutDiagnostic = (listener: () => void): (() => void) => {
  diagnosticListeners.add(listener)

  return () => {
    diagnosticListeners.delete(listener)
  }
}

export const getCutoutDiagnostic = (): CutoutDiagnostic | null => {
  return diagnosticHidden ? null : diagnostic
}

/** TEMPORARY. Logs whether the production WebView can read the local assets. */
const logBackgroundRemovalResources = async (base: string): Promise<void> => {
  const resourcesJsonUrl = new URL('resources.json', base).href

  console.error('[Pixen] Background removal diagnostic', { publicPath: base })
  console.error('[Pixen] Background removal diagnostic', { resourcesJson: resourcesJsonUrl })

  patchDiagnostic({ resources: await logResourceProbe(base, 'resources.json', false) })
  patchDiagnostic({ wasm: await logResourceProbe(base, WASM_CHUNK, true) })
  patchDiagnostic({ mjs: await logResourceProbe(base, MJS_CHUNK, true) })
}

const enqueue = <T>(work: () => Promise<T>): Promise<T> => {
  // Queued behind the previous run either way: one failure must not wedge
  // every cutout after it.
  const result = queue.then(work, work)

  queue = result.catch(() => undefined)

  return result
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
  signal?: AbortSignal,
): Promise<string> => {
  const base = publicPath()

  publishDiagnostic({
    publicPath: base,
    resourcesJsonUrl: new URL('resources.json', base).href,
    resources: null,
    wasm: null,
    mjs: null,
    result: 'Running',
    message: null,
    stack: null,
  })

  try {
    await assertAssetsPresent(base)

    // TEMPORARY. Does not change the result; each probe catches its own failure.
    await logBackgroundRemovalResources(base)

    // The reporter is built inside the queued work, so a caller still waiting
    // its turn reports nothing and its overlay stays on Starting.
    const blob = await enqueue(() => {
      // Read at the front of the queue rather than when queued: cancelling
      // closes the overlay while its turn is still behind inference that
      // nothing can abort, and running that job anyway would only make the
      // next open wait for a cutout no one is going to see.
      signal?.throwIfAborted()

      return removeBackground(dataUrl, {
        publicPath: base,
        model: MODEL,
        output: { format: 'image/png' },
        progress: progressReporter(onProgress),
      })
    })

    const result = await blobToDataUrl(blob)

    patchDiagnostic({ result: 'Success', message: null, stack: null })

    return result
  } catch (error) {
    // Cancelling a queued run rejects with AbortError. That is expected and
    // already ignored by the overlay, so it is not the failure we are tracing.
    if (!(error instanceof DOMException && error.name === 'AbortError')) {
      logBackgroundRemovalFailure(base, error)
      patchDiagnostic({
        result: 'Failed',
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? (error.stack ?? null) : null,
      })
    }

    throw error
  }
}
