import type { ImageEditorRef } from '@unlayer/react-image-editor'
import type { RefObject } from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

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
import type { Arrow } from '@/lib/image/arrow'
import { composeArrows } from '@/lib/image/arrow'
import { captureScreen as runCapture } from '@/lib/image/capture'
import { copyImage as writeToClipboard } from '@/lib/image/clipboard'
import type { SaveFormat } from '@/lib/image/image'
import { baseNameOf, DEFAULT_SAVE_FORMAT, formatForPath, matchesFormat } from '@/lib/image/image'
import { pickImage, pickSaveDestination, readImage, writeImage } from '@/lib/image/imageStorage'
import type { Stamp } from '@/lib/image/increment'
import { composeStamps } from '@/lib/image/increment'
import type { Rect } from '@/lib/image/pixelize'
import { pixelizeImage } from '@/lib/image/pixelize'
import { readRecent, withoutRecent, withRecent, writeRecent } from '@/lib/recent'

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
  /** The flattened image the pixelize overlay selects on; null when closed. */
  pixelizePreview: string | null
  /** Flattens the canvas and opens the pixelize overlay. */
  startPixelize: () => void
  /** Hides the chosen region and hands the result back to the editor. */
  applyPixelize: (region: Rect) => void
  cancelPixelize: () => void
  /** The flattened image the numbering overlay stamps on; null when closed. */
  incrementPreview: string | null
  /** Flattens the canvas and opens the numbering overlay. */
  startIncrement: () => void
  /** Bakes every badge in one pass and hands the result back to the editor. */
  applyIncrement: (stamps: Stamp[]) => void
  cancelIncrement: () => void
  /** The flattened image the arrow overlay draws on; null when closed. */
  arrowPreview: string | null
  /** Flattens the canvas and opens the arrow overlay. */
  startArrow: () => void
  /** Bakes every arrow in one pass and hands the result back to the editor. */
  applyArrow: (arrows: Arrow[]) => void
  cancelArrow: () => void
  /** The flattened image the cutout overlay runs the model on; null when closed. */
  cutoutPreview: string | null
  /** Flattens the canvas and opens the background removal overlay. */
  startCutout: () => void
  /** Accepts the cutout the overlay produced and hands it to the editor. */
  applyCutout: (dataUrl: string) => void
  cancelCutout: () => void
  /** Paths of images opened or saved before, newest first. */
  recent: string[]
  /** Opens a path off the recent list, dropping it if the file has gone. */
  openRecent: (path: string) => void
  clearRecent: () => void
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
  const [pixelizePreview, setPixelizePreview] = useState<string | null>(null)
  const [incrementPreview, setIncrementPreview] = useState<string | null>(null)
  const [arrowPreview, setArrowPreview] = useState<string | null>(null)
  const [cutoutPreview, setCutoutPreview] = useState<string | null>(null)
  // Deliberately outside `session`: the chosen output format is the user's
  // preference, so opening another image must not reset it.
  const [format, setFormatState] = useState<SaveFormat>(DEFAULT_SAVE_FORMAT)
  // Read once: nothing outside Pixen writes this key, so the stored list and
  // this one cannot drift apart while the window is open.
  const [recent, setRecent] = useState<string[]>(readRecent)

  // Mirrors `session` so callbacks wired to window listeners and native
  // dialogs always read current values without being rebuilt.
  const sessionRef = useRef(session)
  const formatRef = useRef(format)
  /** The image last written to disk; null until this image has been saved. */
  const baselineRef = useRef<string | null>(null)
  /**
   * Whether an edit Pixen made itself — a mosaic, a set of numbers — is waiting
   * to be saved. Tracked here because those edits are baked into the image the
   * editor is then handed, which leaves its own change tracking none the wiser.
   */
  const bakedRef = useRef(false)
  const busyRef = useRef(false)

  const applySession = useCallback((next: SessionState) => {
    sessionRef.current = next
    setSession(next)
  }, [])

  const setFormat = useCallback((next: SaveFormat) => {
    formatRef.current = next
    setFormatState(next)
  }, [])

  /**
   * Only a path that has just been read or written lands here, so the list
   * never offers a file Pixen has not proved it can reach.
   */
  const rememberPath = useCallback((path: string) => {
    setRecent((current) => {
      const next = withRecent(current, path)

      writeRecent(next)

      return next
    })
  }, [])

  const forgetPath = useCallback((path: string) => {
    setRecent((current) => {
      const next = withoutRecent(current, path)

      writeRecent(next)

      return next
    })
  }, [])

  const clearRecent = useCallback(() => {
    setRecent([])
    writeRecent([])
  }, [])

  const load = useCallback(
    (image: string, name: string) => {
      baselineRef.current = null
      bakedRef.current = false
      applySession({ image, path: null, name, dirty: false })
      setError(null)
      setPixelizePreview(null)
      setIncrementPreview(null)
      setArrowPreview(null)
      setCutoutPreview(null)
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

    // Pixen's own edits reload the editor, which then reports the new pixels as
    // pristine. Only a save can clear this, or the unsaved dot would vanish a
    // moment after a pixelize and quitting would never think to ask.
    if (bakedRef.current) {
      return true
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
      bakedRef.current = false
      applySession({ ...current, path: destination, dirty: false })
      rememberPath(destination)

      return true
    },
    [applySession, rememberPath, setFormat],
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
      rememberPath(path)
    })
  }, [confirmReplacingImage, load, rememberPath, run])

  const openFromPath = useCallback(
    (path: string) => {
      run(async () => {
        if (!(await confirmReplacingImage())) {
          return
        }

        load(await readImage(path), baseNameOf(path))
        rememberPath(path)
      })
    },
    [confirmReplacingImage, load, rememberPath, run],
  )

  const openRecent = useCallback(
    (path: string) => {
      run(async () => {
        if (!(await confirmReplacingImage())) {
          return
        }

        let image: string

        try {
          image = await readImage(path)
        } catch (failure) {
          // Moved, renamed or deleted since it was opened. Offering it again
          // would fail the same way, so the entry goes with the error.
          forgetPath(path)
          throw failure
        }

        load(image, baseNameOf(path))
        rememberPath(path)
      })
    },
    [confirmReplacingImage, forgetPath, load, rememberPath, run],
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

      // Announced here rather than by the menu, so a copy from the keyboard or
      // the native Edit menu confirms itself too.
      toast.success('Copied to clipboard', { duration: COPIED_FEEDBACK_MS })
    })
  }, [readCurrentImage, run])

  const startPixelize = useCallback(() => {
    run(async () => {
      if (!sessionRef.current.image) {
        return
      }

      // The overlay selects on a flattened copy rather than on the editor's own
      // canvas, whose zoom and pan Unlayer does not report.
      setPixelizePreview(readCurrentImage())
      setIncrementPreview(null)
      setArrowPreview(null)
      setCutoutPreview(null)
    })
  }, [readCurrentImage, run])

  const cancelPixelize = useCallback(() => {
    setPixelizePreview(null)
  }, [])

  const applyPixelize = useCallback(
    (region: Rect) => {
      run(async () => {
        const current = sessionRef.current
        const preview = pixelizePreview

        if (!current.image || !preview) {
          return
        }

        const pixelized = await pixelizeImage(preview, region)

        // Not `load`: this edits the open document, so the path and name stay
        // and the result is unsaved until Save writes it. The baseline is left
        // alone deliberately — the mosaic is a change against the last save.
        bakedRef.current = true
        applySession({ ...current, image: pixelized, dirty: true })
        setPixelizePreview(null)
      })
    },
    [applySession, pixelizePreview, run],
  )

  const startIncrement = useCallback(() => {
    run(async () => {
      if (!sessionRef.current.image) {
        return
      }

      setIncrementPreview(readCurrentImage())
      setPixelizePreview(null)
      setArrowPreview(null)
      setCutoutPreview(null)
    })
  }, [readCurrentImage, run])

  const cancelIncrement = useCallback(() => {
    setIncrementPreview(null)
  }, [])

  const applyIncrement = useCallback(
    (stamps: Stamp[]) => {
      run(async () => {
        const current = sessionRef.current
        const preview = incrementPreview

        if (!current.image || !preview || stamps.length === 0) {
          return
        }

        // Every badge in one composite, so the editor reloads — and loses its
        // undo stack — once rather than once per number.
        const numbered = await composeStamps(preview, stamps)

        bakedRef.current = true
        applySession({ ...current, image: numbered, dirty: true })
        setIncrementPreview(null)
      })
    },
    [applySession, incrementPreview, run],
  )

  const startArrow = useCallback(() => {
    run(async () => {
      if (!sessionRef.current.image) {
        return
      }

      setArrowPreview(readCurrentImage())
      setPixelizePreview(null)
      setIncrementPreview(null)
      setCutoutPreview(null)
    })
  }, [readCurrentImage, run])

  const cancelArrow = useCallback(() => {
    setArrowPreview(null)
  }, [])

  const applyArrow = useCallback(
    (arrows: Arrow[]) => {
      run(async () => {
        const current = sessionRef.current
        const preview = arrowPreview

        if (!current.image || !preview || arrows.length === 0) {
          return
        }

        // Every arrow in one composite, so the editor reloads — and loses its
        // undo stack — once rather than once per arrow.
        const annotated = await composeArrows(preview, arrows)

        bakedRef.current = true
        applySession({ ...current, image: annotated, dirty: true })
        setArrowPreview(null)
      })
    },
    [applySession, arrowPreview, run],
  )

  const startCutout = useCallback(() => {
    run(async () => {
      if (!sessionRef.current.image) {
        return
      }

      setCutoutPreview(readCurrentImage())
      setPixelizePreview(null)
      setIncrementPreview(null)
      setArrowPreview(null)
    })
  }, [readCurrentImage, run])

  const cancelCutout = useCallback(() => {
    setCutoutPreview(null)
  }, [])

  const applyCutout = useCallback(
    (dataUrl: string) => {
      run(async () => {
        const current = sessionRef.current

        // The overlay ran the model and already has the result, so unlike the
        // other tools there is no work left here beyond taking it.
        if (!current.image || !cutoutPreview) {
          return
        }

        bakedRef.current = true
        applySession({ ...current, image: dataUrl, dirty: true })
        setCutoutPreview(null)
      })
    },
    [applySession, cutoutPreview, run],
  )

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

      const baseline = baselineRef.current

      await editor.reset(baseline ?? image)

      // Without a save behind it there is no earlier version to go back to, so
      // any mosaic or numbering baked into the image is still there — and still
      // unsaved — however far the editor's own state was wound back.
      if (baseline !== null) {
        bakedRef.current = false
      }

      applySession({ ...sessionRef.current, dirty: bakedRef.current })
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
    format,
    setFormat,
    openImage,
    openFromPath,
    openFromDataUrl,
    captureScreen,
    copyImage,
    pixelizePreview,
    startPixelize,
    applyPixelize,
    cancelPixelize,
    incrementPreview,
    startIncrement,
    applyIncrement,
    cancelIncrement,
    arrowPreview,
    startArrow,
    applyArrow,
    cancelArrow,
    cutoutPreview,
    startCutout,
    applyCutout,
    cancelCutout,
    recent,
    openRecent,
    clearRecent,
    save,
    saveAs,
    discardEdits,
    requestClose,
    reportError,
    dismissError,
  }
}
