import type { ImageEditorRef } from '@unlayer/react-image-editor'
import type { RefObject } from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'

import {
  COPIED_FEEDBACK_MS,
  SCREENSHOT_NAME,
  UNSAVED_CHECK_DEBOUNCE_MS,
  UNSAVED_CHECK_INTERVAL_MS,
  UNTITLED_NAME,
} from '@/lib/constants'
import { askAboutUnsavedChanges, askToDiscardChanges, quitApp } from '@/lib/desktop'
import { hasUnsavedEdits } from '@/lib/editor/engine'
import { PixenError, toUserMessage } from '@/lib/errors'
import { captureScreen as runCapture } from '@/lib/image/capture'
import { copyImage as writeToClipboard } from '@/lib/image/clipboard'
import type { SaveFormat } from '@/lib/image/image'
import { baseNameOf, DEFAULT_SAVE_FORMAT, formatForPath, matchesFormat } from '@/lib/image/image'
import { pickImage, pickSaveDestination, readImage, writeImage } from '@/lib/image/imageStorage'

interface SessionState {
  /**
   * The image handed to the editor. Only opening a file changes it: the editor
   * reloads — and so discards its undo history — whenever this value moves, so
   * a save deliberately leaves it alone.
   */
  image: string | null
  /** Where Save writes. Null until a save has picked a destination. */
  path: string | null
  /** Base name of the opened file, the default the save dialog offers. */
  name: string | null
  dirty: boolean
}

const EMPTY_SESSION: SessionState = {
  image: null,
  path: null,
  name: null,
  dirty: false,
}

export interface ImageSession extends SessionState {
  busy: boolean
  error: string | null
  /** True for a moment after a copy, so the toolbar can confirm it happened. */
  copied: boolean
  /** The format the next save writes in. */
  format: SaveFormat
  setFormat: (format: SaveFormat) => void
  openImage: () => void
  /** Opens a file Pixen was handed rather than asked for: a drop, or a menu. */
  openFromPath: (path: string) => void
  /** Opens an image with no file behind it, such as a pasted screenshot. */
  openFromDataUrl: (dataUrl: string, name: string) => void
  /** Captures a region of the screen and opens it. macOS only. */
  captureScreen: () => void
  /** Puts the edited image on the system clipboard. */
  copyImage: () => void
  save: () => void
  saveAs: () => void
  discardEdits: () => void
  requestClose: () => void
  reportError: (message: string) => void
  dismissError: () => void
}

/**
 * Owns the open image: what it is, where a save writes, and whether it differs
 * from the copy on disk. Every filesystem call it makes goes through
 * `imageStorage`, so no component touches the disk itself.
 */
export const useImageSession = (editorRef: RefObject<ImageEditorRef | null>): ImageSession => {
  const [session, setSession] = useState<SessionState>(EMPTY_SESSION)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  // Deliberately outside `session`: the chosen output format is the user's
  // preference, so opening another image must not reset it.
  const [format, setFormatState] = useState<SaveFormat>(DEFAULT_SAVE_FORMAT)

  // Mirrors `session` so callbacks wired to window listeners and native
  // dialogs always read current values without being rebuilt.
  const sessionRef = useRef(session)
  const formatRef = useRef(format)
  /** The image last written to disk; null until this image has been saved. */
  const baselineRef = useRef<string | null>(null)
  const busyRef = useRef(false)

  const applySession = useCallback((next: SessionState) => {
    sessionRef.current = next
    setSession(next)
  }, [])

  const setFormat = useCallback((next: SaveFormat) => {
    formatRef.current = next
    setFormatState(next)
  }, [])

  const load = useCallback(
    (image: string, name: string) => {
      baselineRef.current = null
      applySession({ image, path: null, name, dirty: false })
      setError(null)
      setCopied(false)
    },
    [applySession],
  )

  /** Serializes the file actions so two native dialogs can never overlap. */
  const run = useCallback((action: () => Promise<void>) => {
    if (busyRef.current) {
      return
    }

    busyRef.current = true
    setBusy(true)

    void action()
      .catch((failure: unknown) => {
        setError(toUserMessage(failure))
      })
      .finally(() => {
        busyRef.current = false
        setBusy(false)
      })
  }, [])

  const readCurrentImage = useCallback((): string => {
    const image = editorRef.current?.editor?.getImage()

    if (!image) {
      throw new PixenError('Pixen could not read the current image from the editor.')
    }

    return image
  }, [editorRef])

  const isUnsaved = useCallback((): boolean => {
    const editor = editorRef.current?.editor

    if (!editor || !sessionRef.current.image) {
      return false
    }

    return hasUnsavedEdits(editor, baselineRef.current)
  }, [editorRef])

  /** Returns false when the user cancelled the Save dialog. */
  const persist = useCallback(
    async (image: string, path: string | null): Promise<boolean> => {
      const current = sessionRef.current
      const chosen = formatRef.current

      if (!current.image) {
        return false
      }

      // Switching format has to be saved somewhere new, because the extension
      // is part of the name: reusing the path would put JPEG bytes inside the
      // .png the user already has on disk.
      const reusable = path && matchesFormat(path, chosen) ? path : null
      const destination =
        reusable ?? (await pickSaveDestination(current.name ?? UNTITLED_NAME, chosen))

      if (!destination) {
        return false
      }

      // An extension typed into the dialog outranks the selector, so bring the
      // toolbar back in line instead of letting it name a format Pixen is not
      // actually writing.
      const format = formatForPath(destination, chosen)

      setFormat(format)

      // The editor's output goes over as-is: `write_image` encodes it into
      // whatever the destination's extension names.
      await writeImage(destination, image)

      // The baseline is that same output rather than the file on disk:
      // comparing a later export against re-encoded bytes would report the
      // image as unsaved forever.
      baselineRef.current = image
      applySession({ ...current, path: destination, dirty: false })

      return true
    },
    [applySession, setFormat],
  )

  /**
   * The guard every way of opening an image shares. Replacing the open image
   * discards the editor's state, so a dirty session is confirmed first.
   */
  const confirmReplacingImage = useCallback(async (): Promise<boolean> => {
    return !sessionRef.current.dirty || (await askToDiscardChanges())
  }, [])

  const openImage = useCallback(() => {
    run(async () => {
      if (!(await confirmReplacingImage())) {
        return
      }

      const path = await pickImage()

      if (!path) {
        return
      }

      load(await readImage(path), baseNameOf(path))
    })
  }, [confirmReplacingImage, load, run])

  const openFromPath = useCallback(
    (path: string) => {
      run(async () => {
        if (!(await confirmReplacingImage())) {
          return
        }

        load(await readImage(path), baseNameOf(path))
      })
    },
    [confirmReplacingImage, load, run],
  )

  const openFromDataUrl = useCallback(
    (dataUrl: string, name: string) => {
      run(async () => {
        if (!(await confirmReplacingImage())) {
          return
        }

        // No path: a pasted image has no file on disk, so the first save has
        // to ask where to write even though the session is not dirty.
        load(dataUrl, name)
      })
    },
    [confirmReplacingImage, load, run],
  )

  const captureScreen = useCallback(() => {
    run(async () => {
      if (!(await confirmReplacingImage())) {
        return
      }

      const dataUrl = await runCapture()

      // Cancelled: the open image is left exactly as it was.
      if (!dataUrl) {
        return
      }

      load(dataUrl, SCREENSHOT_NAME)
    })
  }, [confirmReplacingImage, load, run])

  const copyImage = useCallback(() => {
    run(async () => {
      if (!sessionRef.current.image) {
        return
      }

      await writeToClipboard(readCurrentImage())
      setCopied(true)
    })
  }, [readCurrentImage, run])

  // The confirmation is transient, so it clears itself rather than needing
  // every other action to remember to reset it.
  useEffect(() => {
    if (!copied) {
      return
    }

    const timer = window.setTimeout(() => setCopied(false), COPIED_FEEDBACK_MS)

    return () => {
      window.clearTimeout(timer)
    }
  }, [copied])

  const save = useCallback(() => {
    run(async () => {
      if (!sessionRef.current.image) {
        return
      }

      await persist(readCurrentImage(), sessionRef.current.path)
    })
  }, [persist, readCurrentImage, run])

  const saveAs = useCallback(() => {
    run(async () => {
      if (!sessionRef.current.image) {
        return
      }

      await persist(readCurrentImage(), null)
    })
  }, [persist, readCurrentImage, run])

  /** Backs the editor's own Cancel button: returns to the last saved state. */
  const discardEdits = useCallback(() => {
    run(async () => {
      const { image, dirty } = sessionRef.current
      const editor = editorRef.current?.editor

      if (!image || !editor || !dirty) {
        return
      }

      if (!(await askToDiscardChanges())) {
        return
      }

      await editor.reset(baselineRef.current ?? image)
      applySession({ ...sessionRef.current, dirty: false })
    })
  }, [applySession, editorRef, run])

  const requestClose = useCallback(() => {
    run(async () => {
      if (isUnsaved()) {
        const decision = await askAboutUnsavedChanges()

        if (decision === 'cancel') {
          return
        }

        // A cancelled Save dialog means nothing was written, so closing is
        // abandoned rather than dropping the work.
        if (decision === 'save' && !(await persist(readCurrentImage(), sessionRef.current.path))) {
          return
        }
      }

      await quitApp()
    })
  }, [isUnsaved, persist, readCurrentImage, run])

  const refreshUnsavedState = useCallback(() => {
    if (!sessionRef.current.image) {
      return
    }

    const dirty = isUnsaved()

    if (dirty !== sessionRef.current.dirty) {
      applySession({ ...sessionRef.current, dirty })
    }
  }, [applySession, isUnsaved])

  const hasImage = session.image !== null

  useEffect(() => {
    if (!hasImage) {
      return
    }

    let debounce: number | undefined

    const schedule = () => {
      window.clearTimeout(debounce)
      debounce = window.setTimeout(refreshUnsavedState, UNSAVED_CHECK_DEBOUNCE_MS)
    }

    const sweep = () => {
      // Deliberately only the cheap check: once something has been saved,
      // deciding whether the canvas moved on means re-flattening it, which is
      // far too much work to repeat on a timer.
      if (baselineRef.current === null) {
        refreshUnsavedState()
      }
    }

    window.addEventListener('pointerup', schedule)
    window.addEventListener('keyup', schedule)
    const sweeper = window.setInterval(sweep, UNSAVED_CHECK_INTERVAL_MS)

    return () => {
      window.clearTimeout(debounce)
      window.clearInterval(sweeper)
      window.removeEventListener('pointerup', schedule)
      window.removeEventListener('keyup', schedule)
    }
  }, [hasImage, refreshUnsavedState])

  const reportError = useCallback((message: string) => {
    setError(message)
  }, [])

  const dismissError = useCallback(() => {
    setError(null)
  }, [])

  return {
    ...session,
    busy,
    error,
    copied,
    format,
    setFormat,
    openImage,
    openFromPath,
    openFromDataUrl,
    captureScreen,
    copyImage,
    save,
    saveAs,
    discardEdits,
    requestClose,
    reportError,
    dismissError,
  }
}
