import type { ImageEditorInstance, ImageEditorOptions } from '@unlayer/react-image-editor'

import { EDITOR_PRELOAD_TIMEOUT_MS } from '@/lib/constants'

/**
 * The CDN embed that @unlayer/react-image-editor loads on demand. Injecting the
 * tag during launch means the editor is ready the moment the first image is
 * opened; the package reuses a host-injected tag instead of adding its own.
 */
const EDITOR_EMBED_URL = 'https://cdn.unlayer.com/image-editor/embed.js'

/**
 * Module-level so the object identity is stable: the component remounts the
 * editor whenever anything outside theme/locale/translations changes. AI is off
 * because Pixen has no account or project id.
 */
export const EDITOR_OPTIONS: ImageEditorOptions = {
  theme: 'dark',
  features: { ai: false },
}

/**
 * Never rejects. The package fetches the engine again when an image is opened
 * and reports failures through `onError` there, so a slow or offline launch
 * only means the splash screen stops waiting.
 */
export const preloadEditorEngine = (): Promise<void> => {
  return new Promise((resolve) => {
    const tag = document.createElement('script')
    const timeout = window.setTimeout(() => resolve(), EDITOR_PRELOAD_TIMEOUT_MS)

    const finish = () => {
      window.clearTimeout(timeout)
      resolve()
    }

    tag.addEventListener('load', finish, { once: true })
    tag.addEventListener(
      'error',
      () => {
        // A tag that fired `error` never fires again, so it is removed to let
        // the package inject a fresh one on the first open.
        tag.remove()
        finish()
      },
      { once: true },
    )

    tag.src = EDITOR_EMBED_URL
    document.head.appendChild(tag)
  })
}

/**
 * The editor emits no change events, so unsaved state is derived on demand.
 *
 * `hasChanges()` is the cheap gate. It keeps returning true after a save, so
 * once something has been written the flattened image is compared against it —
 * the only signal the editor's API offers. `baseline` is null until the first
 * save of the current image, when any edit is unsaved by definition.
 */
export const hasUnsavedEdits = (editor: ImageEditorInstance, baseline: string | null): boolean => {
  if (!editor.hasChanges()) {
    return false
  }

  if (baseline === null) {
    return true
  }

  return editor.getImage() !== baseline
}
