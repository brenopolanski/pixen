import type { ImageEditorRef } from '@unlayer/react-image-editor'
import type { RefObject } from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'

import {
  RECOVERY_INTERVAL_MS,
  UNSAVED_CHECK_DEBOUNCE_MS,
  UNSAVED_CHECK_INTERVAL_MS,
} from '@/lib/constants'
import {
  askAboutUnsavedChanges,
  askToDiscardChanges,
  askToRestoreRecovery,
  quitApp,
} from '@/lib/desktop'
import { hasUnsavedEdits } from '@/lib/editor/engine'
import { PixenError, toUserMessage } from '@/lib/errors'
import {
  baseNameOf,
  createProject,
  projectFileName,
  renameProject,
  withSavedImage,
} from '@/lib/project/project'
import {
  clearRecovery,
  pickImage,
  pickProject,
  pickProjectDestination,
  readImage,
  readProject,
  readRecovery,
  writeProject,
  writeRecovery,
} from '@/lib/project/projectStorage'
import type { PixenProject } from '@/types/project'

interface SessionState {
  project: PixenProject | null
  path: string | null
  dirty: boolean
  /**
   * The image handed to the editor. Only loading a file changes it: the editor
   * reloads — and so discards its undo history — whenever this value moves, so
   * a save deliberately leaves it alone.
   */
  loadedImage: string | null
}

const EMPTY_SESSION: SessionState = {
  project: null,
  path: null,
  dirty: false,
  loadedImage: null,
}

export interface ProjectSession extends SessionState {
  busy: boolean
  error: string | null
  openImage: () => void
  openProject: () => void
  save: () => void
  saveAs: () => void
  discardEdits: () => void
  requestClose: () => void
  restoreRecovery: () => Promise<void>
  reportError: (message: string) => void
  dismissError: () => void
}

/**
 * Owns the open project: what it is, where it lives, and whether it differs
 * from the copy on disk. Every filesystem call it makes goes through
 * `projectStorage`, so no component touches the disk itself.
 */
export const useProjectSession = (editorRef: RefObject<ImageEditorRef | null>): ProjectSession => {
  const [session, setSession] = useState<SessionState>(EMPTY_SESSION)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Mirrors `session` so callbacks wired to window listeners and native
  // dialogs always read current values without being rebuilt.
  const sessionRef = useRef(session)
  /** The image last written to disk; null until this image has been saved. */
  const baselineRef = useRef<string | null>(null)
  /**
   * Recovered work is unsaved even though the editor treats the image it just
   * loaded as pristine, so the flag is held until a real save clears it.
   */
  const unsavedOnDiskRef = useRef(false)
  const busyRef = useRef(false)

  const applySession = useCallback((next: SessionState) => {
    sessionRef.current = next
    setSession(next)
  }, [])

  const load = useCallback(
    (project: PixenProject, path: string | null, dirty = false) => {
      baselineRef.current = null
      unsavedOnDiskRef.current = dirty
      applySession({ project, path, dirty, loadedImage: project.image })
      setError(null)
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

    if (!editor || !sessionRef.current.project) {
      return false
    }

    return unsavedOnDiskRef.current || hasUnsavedEdits(editor, baselineRef.current)
  }, [editorRef])

  /** Returns false when the user cancelled the Save dialog. */
  const persist = useCallback(
    async (image: string, path: string | null): Promise<boolean> => {
      const current = sessionRef.current

      if (!current.project) {
        return false
      }

      const destination = path ?? (await pickProjectDestination(projectFileName(current.project)))

      if (!destination) {
        return false
      }

      const saved = renameProject(withSavedImage(current.project, image), baseNameOf(destination))

      await writeProject(destination, saved)

      baselineRef.current = image
      unsavedOnDiskRef.current = false
      applySession({
        project: saved,
        path: destination,
        dirty: false,
        loadedImage: current.loadedImage,
      })
      await clearRecovery()

      return true
    },
    [applySession],
  )

  const openImage = useCallback(() => {
    run(async () => {
      if (sessionRef.current.dirty && !(await askToDiscardChanges())) {
        return
      }

      const path = await pickImage()

      if (!path) {
        return
      }

      load(createProject(baseNameOf(path), await readImage(path)), null)
    })
  }, [load, run])

  const openProject = useCallback(() => {
    run(async () => {
      if (sessionRef.current.dirty && !(await askToDiscardChanges())) {
        return
      }

      const path = await pickProject()

      if (!path) {
        return
      }

      load(await readProject(path), path)
    })
  }, [load, run])

  const save = useCallback(() => {
    run(async () => {
      if (!sessionRef.current.project) {
        return
      }

      await persist(readCurrentImage(), sessionRef.current.path)
    })
  }, [persist, readCurrentImage, run])

  const saveAs = useCallback(() => {
    run(async () => {
      if (!sessionRef.current.project) {
        return
      }

      await persist(readCurrentImage(), null)
    })
  }, [persist, readCurrentImage, run])

  /** Backs the editor's own Cancel button: returns to the last saved state. */
  const discardEdits = useCallback(() => {
    run(async () => {
      const { project, dirty } = sessionRef.current
      const editor = editorRef.current?.editor

      if (!project || !editor || !dirty) {
        return
      }

      if (!(await askToDiscardChanges())) {
        return
      }

      await editor.reset(baselineRef.current ?? project.image)
      unsavedOnDiskRef.current = false
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

      await clearRecovery()
      await quitApp()
    })
  }, [isUnsaved, persist, readCurrentImage, run])

  const restoreRecovery = useCallback(async (): Promise<void> => {
    try {
      const snapshot = await readRecovery()

      if (!snapshot) {
        return
      }

      if (await askToRestoreRecovery()) {
        load(snapshot.project, snapshot.path, true)
        return
      }

      await clearRecovery()
    } catch (failure) {
      setError(toUserMessage(failure))
    }
  }, [load])

  const refreshUnsavedState = useCallback(() => {
    if (!sessionRef.current.project) {
      return
    }

    const dirty = isUnsaved()

    if (dirty !== sessionRef.current.dirty) {
      applySession({ ...sessionRef.current, dirty })
    }
  }, [applySession, isUnsaved])

  const hasProject = session.project !== null

  useEffect(() => {
    if (!hasProject) {
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
  }, [hasProject, refreshUnsavedState])

  useEffect(() => {
    if (!session.dirty) {
      return
    }

    const interval = window.setInterval(() => {
      const { project, path } = sessionRef.current
      const image = editorRef.current?.editor?.getImage()

      if (!project || !image) {
        return
      }

      void writeRecovery({
        path,
        project: withSavedImage(project, image),
        savedAt: new Date().toISOString(),
      }).catch((failure: unknown) => {
        // Recovery is background bookkeeping. Failing to park a snapshot must
        // not interrupt the user, who still has an explicit Save.
        console.error('[pixen] could not write a recovery snapshot', failure)
      })
    }, RECOVERY_INTERVAL_MS)

    return () => {
      window.clearInterval(interval)
    }
  }, [editorRef, session.dirty])

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
    openImage,
    openProject,
    save,
    saveAs,
    discardEdits,
    requestClose,
    restoreRecovery,
    reportError,
    dismissError,
  }
}
