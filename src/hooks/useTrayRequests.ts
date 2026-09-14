import { useEffect } from 'react'

import { CAPTURE_REQUESTED_EVENT, QUIT_REQUESTED_EVENT } from '@/lib/constants'
import { onTrayRequest } from '@/lib/desktop'

interface TrayHandlers {
  onCaptureScreen: () => void
  onQuit: () => void
}

/**
 * Routes the menu bar item and the global capture shortcut back through the
 * session, so a shot taken from the tray lands in a tab under the same rules
 * as one taken from the toolbar — and Quit still gets to ask about unsaved
 * work before anything exits.
 */
export const useTrayRequests = ({ onCaptureScreen, onQuit }: TrayHandlers) => {
  useEffect(() => {
    let disposed = false
    const stops: (() => void)[] = []

    const subscribe = (event: string, handler: () => void) => {
      void onTrayRequest(event, () => {
        if (!disposed) {
          handler()
        }
      })
        .then((stop) => {
          if (disposed) {
            stop()
            return
          }

          stops.push(stop)
        })
        .catch((failure: unknown) => {
          console.error(`[pixen] could not listen for ${event}`, failure)
        })
    }

    subscribe(CAPTURE_REQUESTED_EVENT, onCaptureScreen)
    subscribe(QUIT_REQUESTED_EVENT, onQuit)

    return () => {
      disposed = true
      stops.forEach((stop) => {
        stop()
      })
    }
  }, [onCaptureScreen, onQuit])
}
