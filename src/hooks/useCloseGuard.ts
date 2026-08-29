import { useEffect } from 'react'

import { onCloseRequested } from '@/lib/desktop'

/**
 * Hands the window's close button to `onRequest`, which is responsible for
 * actually quitting once it has dealt with any unsaved work.
 */
export const useCloseGuard = (onRequest: () => void) => {
  useEffect(() => {
    let disposed = false
    let unlisten: (() => void) | undefined

    void onCloseRequested(() => {
      if (!disposed) {
        onRequest()
      }
    })
      .then((stop) => {
        if (disposed) {
          stop()
          return
        }

        unlisten = stop
      })
      .catch((failure: unknown) => {
        console.error('[pixen] could not guard the close button', failure)
      })

    return () => {
      disposed = true
      unlisten?.()
    }
  }, [onRequest])
}
