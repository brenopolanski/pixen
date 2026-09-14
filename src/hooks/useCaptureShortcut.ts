import { useCallback, useEffect, useState } from 'react'

import { getCaptureShortcut, setCaptureShortcut } from '@/lib/desktop'
import { DEFAULT_CAPTURE_ACCELERATOR } from '@/lib/shortcuts'

/**
 * Mirrors the capture combo Rust has registered.
 *
 * Rust stays the source of truth — it is what the system actually answers —
 * so the local copy only ever moves to what a command reports back.
 */
export const useCaptureShortcut = () => {
  const [accelerator, setAccelerator] = useState(DEFAULT_CAPTURE_ACCELERATOR)

  useEffect(() => {
    let disposed = false

    void getCaptureShortcut()
      .then((current) => {
        if (!disposed) {
          setAccelerator(current)
        }
      })
      .catch((failure: unknown) => {
        console.error('[pixen] could not read the capture shortcut', failure)
      })

    return () => {
      disposed = true
    }
  }, [])

  /** Resolves with an error message when the combo was refused. */
  const rebind = useCallback(async (next: string): Promise<string | null> => {
    try {
      setAccelerator(await setCaptureShortcut(next))

      return null
    } catch (failure: unknown) {
      if (typeof failure === 'string') {
        return failure
      }

      if (failure instanceof Error && failure.message) {
        return failure.message
      }

      if (failure && typeof failure === 'object' && 'message' in failure) {
        const message = failure.message

        if (typeof message === 'string' && message.length > 0) {
          return message
        }
      }

      return 'That shortcut could not be used.'
    }
  }, [])

  return { captureAccelerator: accelerator, rebindCapture: rebind }
}
