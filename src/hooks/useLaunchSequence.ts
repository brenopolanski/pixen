import { useEffect, useRef } from 'react'

import { SPLASH_MIN_DURATION_MS } from '@/lib/constants'
import { finishLaunch } from '@/lib/desktop'
import { preloadEditorEngine } from '@/lib/editor/engine'
import { delay } from '@/lib/utils'

/**
 * Startup, in order: warm the editor engine, hold the splash screen for long
 * enough to read, then hand the screen over to the main window. A ref guards
 * the sequence because React runs effects twice in development.
 */
export const useLaunchSequence = () => {
  const launchedRef = useRef(false)

  useEffect(() => {
    if (launchedRef.current) {
      return
    }

    launchedRef.current = true

    const launch = async () => {
      await Promise.all([preloadEditorEngine(), delay(SPLASH_MIN_DURATION_MS)])
      await finishLaunch()
    }

    void launch().catch((failure: unknown) => {
      console.error('[pixen] launch sequence failed', failure)
    })
  }, [])
}
