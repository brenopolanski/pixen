import { useEffect, useRef } from 'react'

import { SPLASH_MIN_DURATION_MS } from '@/lib/constants'
import { finishLaunch } from '@/lib/desktop'
import { preloadEditorEngine } from '@/lib/editor/engine'

const delay = (ms: number): Promise<void> => {
  return new Promise((resolve) => {
    window.setTimeout(() => resolve(), ms)
  })
}

/**
 * Startup, in order: warm the editor engine, hold the splash screen for long
 * enough to read, hand the screen over to the main window, then let the app
 * finish initialising. A ref guards the sequence because React runs effects
 * twice in development.
 */
export const useLaunchSequence = (onReady: () => Promise<void>) => {
  const readyRef = useRef(onReady)
  const launchedRef = useRef(false)

  useEffect(() => {
    readyRef.current = onReady
  })

  useEffect(() => {
    if (launchedRef.current) {
      return
    }

    launchedRef.current = true

    const launch = async () => {
      await Promise.all([preloadEditorEngine(), delay(SPLASH_MIN_DURATION_MS)])
      await finishLaunch()
      await readyRef.current()
    }

    void launch().catch((failure: unknown) => {
      console.error('[pixen] launch sequence failed', failure)
    })
  }, [])
}
