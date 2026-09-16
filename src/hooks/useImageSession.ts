import type { ImageEditorRef } from '@unlayer/react-image-editor'
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

import {
  COPIED_FEEDBACK_MS,
  SCREENSHOT_NAME,
  UNSAVED_CHECK_DEBOUNCE_MS,
  UNSAVED_CHECK_INTERVAL_MS,
  UNTITLED_NAME,
} from '@/lib/constants'
import {
  askAboutUnsavedChanges,
  askToApplyOverlay,
  askToDiscardChanges,
  quitApp,
} from '@/lib/desktop'
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
import type { OverlayDraft } from '@/lib/overlay'
import { overlayNeedsPrompt } from '@/lib/overlay'
import { readRecent, withoutRecent, withRecent, writeRecent } from '@/lib/recent'
import type { ImageTab } from '@/lib/tabs'
import { decideOpenAction, nextTabAfterClose } from '@/lib/tabs'

interface SessionState {
  tabs: ImageTab[]
  activeId: string | null
}

const EMPTY_SESSION: SessionState = {
  tabs: [],
  activeId: null,
}

export interface ImageSession {
  tabs: ImageTab[]
  activeId: string | null
  /** Convenience: the active tab's image, or null when none are open. */
  image: string | null
  path: string | null
  name: string | null
  dirty: boolean
  busy: boolean
  error: string | null
  /** True while a tool overlay covers the canvas — tabs must not move. */
  overlayOpen: boolean
  format: SaveFormat
  setFormat: (format: SaveFormat) => void
  setEditorRef: (tabId: string, editor: ImageEditorRef | null) => void
  activateTab: (tabId: string) => void
  closeTab: (tabId: string) => void
  openImage: () => void
  /** File picker that always creates a tab; never replaces a clean one. */
  openInNewTab: () => void
  openFromPath: (path: string) => void
  openFromDataUrl: (dataUrl: string, name: string) => void
  captureScreen: () => void
  copyImage: () => void
  pixelizePreview: string | null
  startPixelize: () => void
  applyPixelize: (regions: Rect[]) => void
  cancelPixelize: () => void
  reportPixelizeDraft: (regions: Rect[]) => void
  incrementPreview: string | null
  startIncrement: () => void
  applyIncrement: (stamps: Stamp[]) => void
  cancelIncrement: () => void
  /** The flattened image the arrow overlay draws on; null when closed. */
  arrowPreview: string | null
  /** Flattens the canvas and opens the arrow overlay. */
  startArrow: () => void
  /** Bakes every arrow in one pass and hands the result back to the editor. */
  applyArrow: (arrows: Arrow[]) => void
  cancelArrow: () => void
  reportArrowDraft: (arrows: Arrow[]) => void
  reportIncrementDraft: (stamps: Stamp[]) => void
  reportCutoutDraft: (image: string | null) => void
  /** The flattened image the cutout overlay runs the model on; null when closed. */
  cutoutPreview: string | null
  startCutout: () => void
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

const createTabId = (): string => {
  return `tab-${crypto.randomUUID()}`
}

const activeTabOf = (state: SessionState): ImageTab | null => {
  return state.tabs.find((tab) => tab.id === state.activeId) ?? null
}

/**
 * Owns the open images: what they are, where a save writes, and which tab is
 * in front. Every filesystem call goes through `imageStorage`.
 */
export const useImageSession = (): ImageSession => {
  const [session, setSession] = useState<SessionState>(EMPTY_SESSION)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pixelizePreview, setPixelizePreview] = useState<string | null>(null)
  const [incrementPreview, setIncrementPreview] = useState<string | null>(null)
  const [arrowPreview, setArrowPreview] = useState<string | null>(null)
  const [cutoutPreview, setCutoutPreview] = useState<string | null>(null)
  const [format, setFormatState] = useState<SaveFormat>(DEFAULT_SAVE_FORMAT)
  // Read once: nothing outside Pixen writes this key, so the stored list and
  // this one cannot drift apart while the window is open.
  const [recent, setRecent] = useState<string[]>(readRecent)

  const sessionRef = useRef(session)
  const formatRef = useRef(format)
  const editorRefs = useRef(new Map<string, ImageEditorRef>())
  /** Image last written to disk for that tab; missing until it has been saved. */
  const baselinesRef = useRef(new Map<string, string | null>())
  const bakedRef = useRef(new Map<string, boolean>())
  const busyRef = useRef(false)
  const pixelizePreviewRef = useRef<string | null>(null)
  const incrementPreviewRef = useRef<string | null>(null)
  const arrowPreviewRef = useRef<string | null>(null)
  const cutoutPreviewRef = useRef<string | null>(null)
  const overlayDraftRef = useRef<{
    arrows: Arrow[]
    stamps: Stamp[]
    regions: Rect[]
    cutout: string | null
  }>({
    arrows: [],
    stamps: [],
    regions: [],
    cutout: null,
  })

  const overlayOpen =
    pixelizePreview !== null ||
    incrementPreview !== null ||
    arrowPreview !== null ||
    cutoutPreview !== null
  const overlayOpenRef = useRef(overlayOpen)

  useEffect(() => {
    overlayOpenRef.current = overlayOpen
  }, [overlayOpen])

  const applySession = useCallback((next: SessionState) => {
    sessionRef.current = next
    setSession(next)
  }, [])

  const patchTab = useCallback(
    (tabId: string, patch: Partial<ImageTab>) => {
      const current = sessionRef.current
      applySession({
        ...current,
        tabs: current.tabs.map((tab) => (tab.id === tabId ? { ...tab, ...patch } : tab)),
      })
    },
    [applySession],
  )

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

  const setEditorRef = useCallback((tabId: string, editor: ImageEditorRef | null) => {
    if (editor) {
      editorRefs.current.set(tabId, editor)
    } else {
      editorRefs.current.delete(tabId)
    }
  }, [])

  const editorOf = useCallback((tabId: string) => {
    return editorRefs.current.get(tabId)?.editor ?? null
  }, [])

  const clearOverlays = useCallback(() => {
    pixelizePreviewRef.current = null
    incrementPreviewRef.current = null
    arrowPreviewRef.current = null
    cutoutPreviewRef.current = null
    overlayDraftRef.current = { arrows: [], stamps: [], regions: [], cutout: null }
    overlayOpenRef.current = false
    setPixelizePreview(null)
    setIncrementPreview(null)
    setArrowPreview(null)
    setCutoutPreview(null)
  }, [])

  const forgetTab = useCallback((tabId: string) => {
    editorRefs.current.delete(tabId)
    baselinesRef.current.delete(tabId)
    bakedRef.current.delete(tabId)
  }, [])

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

  const readTabImage = useCallback(
    (tabId: string): string => {
      const image = editorOf(tabId)?.getImage()

      if (!image) {
        throw new PixenError('Pixen could not read the current image from the editor.')
      }

      return image
    },
    [editorOf],
  )

  const readCurrentImage = useCallback((): string => {
    const active = activeTabOf(sessionRef.current)

    if (!active) {
      throw new PixenError('Pixen could not read the current image from the editor.')
    }

    return readTabImage(active.id)
  }, [readTabImage])

  const currentOverlayDraft = useCallback((): OverlayDraft => {
    if (arrowPreviewRef.current !== null) {
      return { type: 'arrow', arrows: overlayDraftRef.current.arrows }
    }

    if (pixelizePreviewRef.current !== null) {
      return { type: 'pixelize', regions: overlayDraftRef.current.regions }
    }

    if (incrementPreviewRef.current !== null) {
      return { type: 'increment', stamps: overlayDraftRef.current.stamps }
    }

    if (cutoutPreviewRef.current !== null) {
      return { type: 'cutout', image: overlayDraftRef.current.cutout }
    }

    return { type: 'none' }
  }, [])

  const bakePending = useCallback(
    async (draft: OverlayDraft): Promise<string | null> => {
      const active = activeTabOf(sessionRef.current)

      if (!active) {
        return null
      }

      if (draft.type === 'arrow') {
        const preview = arrowPreviewRef.current

        if (!preview || draft.arrows.length === 0) {
          return null
        }

        const annotated = await composeArrows(preview, draft.arrows)

        bakedRef.current.set(active.id, true)
        patchTab(active.id, { image: annotated, dirty: true })
        return annotated
      }

      if (draft.type === 'pixelize') {
        const preview = pixelizePreviewRef.current

        if (!preview || draft.regions.length === 0) {
          return null
        }

        const pixelized = await pixelizeImage(preview, draft.regions)

        bakedRef.current.set(active.id, true)
        patchTab(active.id, { image: pixelized, dirty: true })
        return pixelized
      }

      if (draft.type === 'increment') {
        const preview = incrementPreviewRef.current

        if (!preview || draft.stamps.length === 0) {
          return null
        }

        const numbered = await composeStamps(preview, draft.stamps)

        bakedRef.current.set(active.id, true)
        patchTab(active.id, { image: numbered, dirty: true })
        return numbered
      }

      if (draft.type === 'cutout' && draft.image) {
        bakedRef.current.set(active.id, true)
        patchTab(active.id, { image: draft.image, dirty: true })
        return draft.image
      }

      return null
    },
    [patchTab],
  )

  /**
   * Close the open overlay, baking first if the user asks. Returns the image
   * the next tool should show, or false when the user stayed on the overlay.
   */
  const settleOverlay = useCallback(async (): Promise<string | false> => {
    if (!overlayOpenRef.current) {
      return activeTabOf(sessionRef.current) ? readCurrentImage() : ''
    }

    const draft = currentOverlayDraft()

    if (overlayNeedsPrompt(draft)) {
      const decision = await askToApplyOverlay()

      if (decision === 'cancel') {
        return false
      }

      if (decision === 'apply') {
        const baked = await bakePending(draft)

        clearOverlays()
        return baked ?? (activeTabOf(sessionRef.current) ? readCurrentImage() : '')
      }
    }

    clearOverlays()
    return activeTabOf(sessionRef.current) ? readCurrentImage() : ''
  }, [bakePending, clearOverlays, currentOverlayDraft, readCurrentImage])

  const placeImage = useCallback(
    async (image: string, name: string, options?: { forceNew?: boolean }): Promise<boolean> => {
      if ((await settleOverlay()) === false) {
        return false
      }

      const current = sessionRef.current
      const action = options?.forceNew
        ? { type: 'create' as const }
        : decideOpenAction(current.tabs, current.activeId)

      setError(null)

      if (action.type === 'replace') {
        baselinesRef.current.set(action.tabId, null)
        bakedRef.current.set(action.tabId, false)
        applySession({
          tabs: current.tabs.map((tab) =>
            tab.id === action.tabId ? { ...tab, image, path: null, name, dirty: false } : tab,
          ),
          activeId: action.tabId,
        })
        return true
      }

      const id = createTabId()
      baselinesRef.current.set(id, null)
      bakedRef.current.set(id, false)
      applySession({
        tabs: [...current.tabs, { id, image, path: null, name, dirty: false }],
        activeId: id,
      })
      return true
    },
    [applySession, settleOverlay],
  )

  const isTabUnsaved = useCallback(
    (tabId: string): boolean => {
      const editor = editorOf(tabId)
      const tab = sessionRef.current.tabs.find((entry) => entry.id === tabId)

      if (!editor || !tab) {
        return false
      }

      if (bakedRef.current.get(tabId)) {
        return true
      }

      return hasUnsavedEdits(editor, baselinesRef.current.get(tabId) ?? null)
    },
    [editorOf],
  )

  const anyUnsaved = useCallback((): boolean => {
    return sessionRef.current.tabs.some((tab) => tab.dirty || isTabUnsaved(tab.id))
  }, [isTabUnsaved])

  const persistTab = useCallback(
    async (tab: ImageTab, image: string, path: string | null): Promise<boolean> => {
      const chosen = formatRef.current
      const reusable = path && matchesFormat(path, chosen) ? path : null
      const destination = reusable ?? (await pickSaveDestination(tab.name ?? UNTITLED_NAME, chosen))

      if (!destination) {
        return false
      }

      const format = formatForPath(destination, chosen)

      setFormat(format)
      await writeImage(destination, image)

      baselinesRef.current.set(tab.id, image)
      bakedRef.current.set(tab.id, false)
      patchTab(tab.id, { path: destination, dirty: false })
      rememberPath(destination)

      return true
    },
    [patchTab, rememberPath, setFormat],
  )

  const openImage = useCallback(() => {
    run(async () => {
      const path = await pickImage()

      if (!path) {
        return
      }

      if (!(await placeImage(await readImage(path), baseNameOf(path)))) {
        return
      }

      rememberPath(path)
    })
  }, [placeImage, rememberPath, run])

  const openInNewTab = useCallback(() => {
    run(async () => {
      const path = await pickImage()

      if (!path) {
        return
      }

      if (!(await placeImage(await readImage(path), baseNameOf(path), { forceNew: true }))) {
        return
      }

      rememberPath(path)
    })
  }, [placeImage, rememberPath, run])

  const openFromPath = useCallback(
    (path: string) => {
      run(async () => {
        if (!(await placeImage(await readImage(path), baseNameOf(path)))) {
          return
        }

        rememberPath(path)
      })
    },
    [placeImage, rememberPath, run],
  )

  const openRecent = useCallback(
    (path: string) => {
      run(async () => {
        let image: string

        try {
          image = await readImage(path)
        } catch (failure) {
          // Moved, renamed or deleted since it was opened. Offering it again
          // would fail the same way, so the entry goes with the error.
          forgetPath(path)
          throw failure
        }

        if (!(await placeImage(image, baseNameOf(path)))) {
          return
        }

        rememberPath(path)
      })
    },
    [forgetPath, placeImage, rememberPath, run],
  )

  const openFromDataUrl = useCallback(
    (dataUrl: string, name: string) => {
      run(async () => {
        await placeImage(dataUrl, name)
      })
    },
    [placeImage, run],
  )

  const captureScreen = useCallback(() => {
    run(async () => {
      const dataUrl = await runCapture()

      if (!dataUrl) {
        return
      }

      await placeImage(dataUrl, SCREENSHOT_NAME)
    })
  }, [placeImage, run])

  const copyImage = useCallback(() => {
    run(async () => {
      if (!activeTabOf(sessionRef.current)) {
        return
      }

      const image = await settleOverlay()

      if (image === false || image === '') {
        return
      }

      await writeToClipboard(image)
      toast.success('Copied to clipboard', { duration: COPIED_FEEDBACK_MS })
    })
  }, [run, settleOverlay])

  const startPixelize = useCallback(() => {
    if (pixelizePreviewRef.current !== null) {
      return
    }

    run(async () => {
      if (!activeTabOf(sessionRef.current)) {
        return
      }

      const image = await settleOverlay()

      if (image === false) {
        return
      }

      pixelizePreviewRef.current = image
      overlayOpenRef.current = true
      setPixelizePreview(image)
    })
  }, [run, settleOverlay])

  const cancelPixelize = useCallback(() => {
    pixelizePreviewRef.current = null
    overlayDraftRef.current.regions = []
    overlayOpenRef.current = false
    setPixelizePreview(null)
  }, [])

  const applyPixelize = useCallback(
    (regions: Rect[]) => {
      run(async () => {
        const active = activeTabOf(sessionRef.current)
        const preview = pixelizePreview

        if (!active || !preview || regions.length === 0) {
          return
        }

        const pixelized = await pixelizeImage(preview, regions)

        bakedRef.current.set(active.id, true)
        patchTab(active.id, { image: pixelized, dirty: true })
        pixelizePreviewRef.current = null
        overlayDraftRef.current.regions = []
        overlayOpenRef.current = false
        setPixelizePreview(null)
      })
    },
    [patchTab, pixelizePreview, run],
  )

  const startIncrement = useCallback(() => {
    if (incrementPreviewRef.current !== null) {
      return
    }

    run(async () => {
      if (!activeTabOf(sessionRef.current)) {
        return
      }

      const image = await settleOverlay()

      if (image === false) {
        return
      }

      incrementPreviewRef.current = image
      overlayOpenRef.current = true
      setIncrementPreview(image)
    })
  }, [run, settleOverlay])

  const cancelIncrement = useCallback(() => {
    incrementPreviewRef.current = null
    overlayDraftRef.current.stamps = []
    overlayOpenRef.current = false
    setIncrementPreview(null)
  }, [])

  const applyIncrement = useCallback(
    (stamps: Stamp[]) => {
      run(async () => {
        const active = activeTabOf(sessionRef.current)
        const preview = incrementPreview

        if (!active || !preview || stamps.length === 0) {
          return
        }

        const numbered = await composeStamps(preview, stamps)

        bakedRef.current.set(active.id, true)
        patchTab(active.id, { image: numbered, dirty: true })
        incrementPreviewRef.current = null
        overlayDraftRef.current.stamps = []
        overlayOpenRef.current = false
        setIncrementPreview(null)
      })
    },
    [incrementPreview, patchTab, run],
  )

  const startArrow = useCallback(() => {
    if (arrowPreviewRef.current !== null) {
      return
    }

    run(async () => {
      if (!activeTabOf(sessionRef.current)) {
        return
      }

      const image = await settleOverlay()

      if (image === false) {
        return
      }

      arrowPreviewRef.current = image
      overlayOpenRef.current = true
      setArrowPreview(image)
    })
  }, [run, settleOverlay])

  const cancelArrow = useCallback(() => {
    arrowPreviewRef.current = null
    overlayDraftRef.current.arrows = []
    overlayOpenRef.current = false
    setArrowPreview(null)
  }, [])

  const applyArrow = useCallback(
    (arrows: Arrow[]) => {
      run(async () => {
        const active = activeTabOf(sessionRef.current)
        const preview = arrowPreview

        if (!active || !preview || arrows.length === 0) {
          return
        }

        // Every arrow in one composite, so the editor reloads — and loses its
        // undo stack — once rather than once per arrow.
        const annotated = await composeArrows(preview, arrows)

        bakedRef.current.set(active.id, true)
        patchTab(active.id, { image: annotated, dirty: true })
        arrowPreviewRef.current = null
        overlayDraftRef.current.arrows = []
        overlayOpenRef.current = false
        setArrowPreview(null)
      })
    },
    [arrowPreview, patchTab, run],
  )

  const startCutout = useCallback(() => {
    if (cutoutPreviewRef.current !== null) {
      return
    }

    run(async () => {
      if (!activeTabOf(sessionRef.current)) {
        return
      }

      const image = await settleOverlay()

      if (image === false) {
        return
      }

      cutoutPreviewRef.current = image
      overlayOpenRef.current = true
      setCutoutPreview(image)
    })
  }, [run, settleOverlay])

  const cancelCutout = useCallback(() => {
    cutoutPreviewRef.current = null
    overlayDraftRef.current.cutout = null
    overlayOpenRef.current = false
    setCutoutPreview(null)
  }, [])

  const applyCutout = useCallback(
    (dataUrl: string) => {
      run(async () => {
        const active = activeTabOf(sessionRef.current)

        if (!active || !cutoutPreview) {
          return
        }

        bakedRef.current.set(active.id, true)
        patchTab(active.id, { image: dataUrl, dirty: true })
        cutoutPreviewRef.current = null
        overlayDraftRef.current.cutout = null
        overlayOpenRef.current = false
        setCutoutPreview(null)
      })
    },
    [cutoutPreview, patchTab, run],
  )

  const save = useCallback(() => {
    run(async () => {
      const active = activeTabOf(sessionRef.current)

      if (!active) {
        return
      }

      await persistTab(active, readTabImage(active.id), active.path)
    })
  }, [persistTab, readTabImage, run])

  const saveAs = useCallback(() => {
    run(async () => {
      const active = activeTabOf(sessionRef.current)

      if (!active) {
        return
      }

      await persistTab(active, readTabImage(active.id), null)
    })
  }, [persistTab, readTabImage, run])

  const discardEdits = useCallback(() => {
    run(async () => {
      const active = activeTabOf(sessionRef.current)
      const editor = active ? editorOf(active.id) : null

      if (!active || !editor || !active.dirty) {
        return
      }

      if (!(await askToDiscardChanges())) {
        return
      }

      const baseline = baselinesRef.current.get(active.id) ?? null

      await editor.reset(baseline ?? active.image)

      if (baseline !== null) {
        bakedRef.current.set(active.id, false)
      }

      patchTab(active.id, { dirty: bakedRef.current.get(active.id) === true })
    })
  }, [editorOf, patchTab, run])

  const snapshotActiveDirty = useCallback(() => {
    const active = activeTabOf(sessionRef.current)

    if (!active) {
      return
    }

    const dirty = isTabUnsaved(active.id)

    if (dirty !== active.dirty) {
      patchTab(active.id, { dirty })
    }
  }, [isTabUnsaved, patchTab])

  const activateTab = useCallback(
    (tabId: string) => {
      if (overlayOpenRef.current || busyRef.current) {
        return
      }

      const current = sessionRef.current

      if (current.activeId === tabId || !current.tabs.some((tab) => tab.id === tabId)) {
        return
      }

      snapshotActiveDirty()
      applySession({ ...sessionRef.current, activeId: tabId })
    },
    [applySession, snapshotActiveDirty],
  )

  const removeTab = useCallback(
    (tabId: string) => {
      const current = sessionRef.current
      const nextActive = nextTabAfterClose(current.tabs, tabId)

      forgetTab(tabId)
      applySession({
        tabs: current.tabs.filter((tab) => tab.id !== tabId),
        activeId: nextActive?.id ?? null,
      })
    },
    [applySession, forgetTab],
  )

  const closeTab = useCallback(
    (tabId: string) => {
      run(async () => {
        if (overlayOpenRef.current) {
          return
        }

        const tab = sessionRef.current.tabs.find((entry) => entry.id === tabId)

        if (!tab) {
          return
        }

        if (tab.dirty || isTabUnsaved(tab.id)) {
          const decision = await askAboutUnsavedChanges()

          if (decision === 'cancel') {
            return
          }

          if (decision === 'save' && !(await persistTab(tab, readTabImage(tab.id), tab.path))) {
            return
          }
        }

        removeTab(tabId)
      })
    },
    [isTabUnsaved, persistTab, readTabImage, removeTab, run],
  )

  const requestClose = useCallback(() => {
    run(async () => {
      snapshotActiveDirty()

      if (anyUnsaved()) {
        const decision = await askAboutUnsavedChanges()

        if (decision === 'cancel') {
          return
        }

        if (decision === 'save') {
          for (const tab of sessionRef.current.tabs) {
            if (!(tab.dirty || isTabUnsaved(tab.id))) {
              continue
            }

            if (!(await persistTab(tab, readTabImage(tab.id), tab.path))) {
              return
            }
          }
        }
      }

      await quitApp()
    })
  }, [anyUnsaved, isTabUnsaved, persistTab, readTabImage, run, snapshotActiveDirty])

  const refreshUnsavedState = useCallback(() => {
    snapshotActiveDirty()
  }, [snapshotActiveDirty])

  const hasImage = session.tabs.length > 0

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
      const active = activeTabOf(sessionRef.current)

      if (active && (baselinesRef.current.get(active.id) ?? null) === null) {
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

  const reportPixelizeDraft = useCallback((regions: Rect[]) => {
    overlayDraftRef.current.regions = regions
  }, [])

  const reportArrowDraft = useCallback((arrows: Arrow[]) => {
    overlayDraftRef.current.arrows = arrows
  }, [])

  const reportIncrementDraft = useCallback((stamps: Stamp[]) => {
    overlayDraftRef.current.stamps = stamps
  }, [])

  const reportCutoutDraft = useCallback((image: string | null) => {
    overlayDraftRef.current.cutout = image
  }, [])

  const active = activeTabOf(session)

  return {
    tabs: session.tabs,
    activeId: session.activeId,
    image: active?.image ?? null,
    path: active?.path ?? null,
    name: active?.name ?? null,
    dirty: active?.dirty ?? false,
    busy,
    error,
    overlayOpen,
    format,
    setFormat,
    setEditorRef,
    activateTab,
    closeTab,
    openImage,
    openInNewTab,
    openFromPath,
    openFromDataUrl,
    captureScreen,
    copyImage,
    pixelizePreview,
    startPixelize,
    applyPixelize,
    cancelPixelize,
    reportPixelizeDraft,
    incrementPreview,
    startIncrement,
    applyIncrement,
    cancelIncrement,
    arrowPreview,
    startArrow,
    applyArrow,
    cancelArrow,
    reportArrowDraft,
    reportIncrementDraft,
    reportCutoutDraft,
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
