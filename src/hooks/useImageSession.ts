import type { ImageEditorRef } from '@unlayer/react-image-editor'
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

import {
  COPIED_FEEDBACK_MS,
  MAX_TABS,
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
import type { Stamp } from '@/lib/image/increment'
import { composeStamps } from '@/lib/image/increment'
import type { Rect } from '@/lib/image/pixelize'
import { pixelizeImage } from '@/lib/image/pixelize'
import type { ImageTab } from '@/lib/tabs'
import {
  decideNewTabAction,
  decideOpenAction,
  nextTabAfterClose,
  tabsFullMessage,
} from '@/lib/tabs'

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
  applyPixelize: (region: Rect) => void
  cancelPixelize: () => void
  incrementPreview: string | null
  startIncrement: () => void
  applyIncrement: (stamps: Stamp[]) => void
  cancelIncrement: () => void
  cutoutPreview: string | null
  startCutout: () => void
  applyCutout: (dataUrl: string) => void
  cancelCutout: () => void
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
  const [cutoutPreview, setCutoutPreview] = useState<string | null>(null)
  const [format, setFormatState] = useState<SaveFormat>(DEFAULT_SAVE_FORMAT)

  const sessionRef = useRef(session)
  const formatRef = useRef(format)
  const editorRefs = useRef(new Map<string, ImageEditorRef>())
  /** Image last written to disk for that tab; missing until it has been saved. */
  const baselinesRef = useRef(new Map<string, string | null>())
  const bakedRef = useRef(new Map<string, boolean>())
  const busyRef = useRef(false)

  const overlayOpen =
    pixelizePreview !== null || incrementPreview !== null || cutoutPreview !== null
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
    setPixelizePreview(null)
    setIncrementPreview(null)
    setCutoutPreview(null)
  }, [])

  const forgetTab = useCallback((tabId: string) => {
    editorRefs.current.delete(tabId)
    baselinesRef.current.delete(tabId)
    bakedRef.current.delete(tabId)
  }, [])

  const placeImage = useCallback(
    (image: string, name: string, options?: { forceNew?: boolean }) => {
      const current = sessionRef.current
      const action = options?.forceNew
        ? decideNewTabAction(current.tabs.length, MAX_TABS)
        : decideOpenAction(current.tabs, current.activeId, MAX_TABS)

      if (action.type === 'refuse') {
        throw new PixenError(tabsFullMessage(MAX_TABS))
      }

      clearOverlays()
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
        return
      }

      const id = createTabId()
      baselinesRef.current.set(id, null)
      bakedRef.current.set(id, false)
      applySession({
        tabs: [...current.tabs, { id, image, path: null, name, dirty: false }],
        activeId: id,
      })
    },
    [applySession, clearOverlays],
  )

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

      return true
    },
    [patchTab, setFormat],
  )

  const openImage = useCallback(() => {
    run(async () => {
      const path = await pickImage()

      if (!path) {
        return
      }

      placeImage(await readImage(path), baseNameOf(path))
    })
  }, [placeImage, run])

  const openInNewTab = useCallback(() => {
    run(async () => {
      const path = await pickImage()

      if (!path) {
        return
      }

      placeImage(await readImage(path), baseNameOf(path), { forceNew: true })
    })
  }, [placeImage, run])

  const openFromPath = useCallback(
    (path: string) => {
      run(async () => {
        placeImage(await readImage(path), baseNameOf(path))
      })
    },
    [placeImage, run],
  )

  const openFromDataUrl = useCallback(
    (dataUrl: string, name: string) => {
      run(async () => {
        placeImage(dataUrl, name)
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

      placeImage(dataUrl, SCREENSHOT_NAME)
    })
  }, [placeImage, run])

  const copyImage = useCallback(() => {
    run(async () => {
      if (!activeTabOf(sessionRef.current)) {
        return
      }

      await writeToClipboard(readCurrentImage())
      toast.success('Copied to clipboard', { duration: COPIED_FEEDBACK_MS })
    })
  }, [readCurrentImage, run])

  const startPixelize = useCallback(() => {
    run(async () => {
      if (!activeTabOf(sessionRef.current)) {
        return
      }

      setPixelizePreview(readCurrentImage())
      setIncrementPreview(null)
      setCutoutPreview(null)
    })
  }, [readCurrentImage, run])

  const cancelPixelize = useCallback(() => {
    setPixelizePreview(null)
  }, [])

  const applyPixelize = useCallback(
    (region: Rect) => {
      run(async () => {
        const active = activeTabOf(sessionRef.current)
        const preview = pixelizePreview

        if (!active || !preview) {
          return
        }

        const pixelized = await pixelizeImage(preview, region)

        bakedRef.current.set(active.id, true)
        patchTab(active.id, { image: pixelized, dirty: true })
        setPixelizePreview(null)
      })
    },
    [patchTab, pixelizePreview, run],
  )

  const startIncrement = useCallback(() => {
    run(async () => {
      if (!activeTabOf(sessionRef.current)) {
        return
      }

      setIncrementPreview(readCurrentImage())
      setPixelizePreview(null)
      setCutoutPreview(null)
    })
  }, [readCurrentImage, run])

  const cancelIncrement = useCallback(() => {
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
        setIncrementPreview(null)
      })
    },
    [incrementPreview, patchTab, run],
  )

  const startCutout = useCallback(() => {
    run(async () => {
      if (!activeTabOf(sessionRef.current)) {
        return
      }

      setCutoutPreview(readCurrentImage())
      setPixelizePreview(null)
      setIncrementPreview(null)
    })
  }, [readCurrentImage, run])

  const cancelCutout = useCallback(() => {
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
    incrementPreview,
    startIncrement,
    applyIncrement,
    cancelIncrement,
    cutoutPreview,
    startCutout,
    applyCutout,
    cancelCutout,
    save,
    saveAs,
    discardEdits,
    requestClose,
    reportError,
    dismissError,
  }
}
