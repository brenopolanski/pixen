import { useEffect } from 'react'

import {
  CAPTURE_REQUESTED_EVENT,
  HIDE_REQUESTED_EVENT,
  QUIT_REQUESTED_EVENT,
} from '@/lib/constants'
import { onTrayRequest } from '@/lib/desktop'

interface TrayHandlers {
  onCaptureScreen: () => void
  onQuit: () => void
  onHide: () => void
}

/**
 * Routes the menu bar item and the global capture shortcut back through the
 * session, so a shot taken from the tray lands in a tab under the same rules
 * as one taken from the toolbar. Quit still asks about unsaved work before
 * exiting. The red close button asks the same way, then hides the window.
 */
export const useTrayRequests = ({ onCaptureScreen, onHide, onQuit }: TrayHandlers) => {
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
    subscribe(HIDE_REQUESTED_EVENT, onHide)
    subscribe(QUIT_REQUESTED_EVENT, onQuit)

    return () => {
      disposed = true
      stops.forEach((stop) => {
        stop()
      })
    }
  }, [onCaptureScreen, onHide, onQuit])
}
