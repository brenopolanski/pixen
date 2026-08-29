import { useEffect } from 'react'

import { UNTITLED_NAME } from '@/lib/constants'
import { toUserMessage } from '@/lib/errors'
import {
  hasUnsupportedImage,
  isTextEntryTarget,
  pastedImage,
  readAsDataUrl,
} from '@/lib/image/clipboard'
import { baseNameOf } from '@/lib/image/image'

interface ClipboardPasteHandlers {
  onOpenDataUrl: (dataUrl: string, name: string) => void
  onReject: (message: string) => void
}

/**
 * Opens an image pasted into the window — a screenshot, or a file copied in a
 * file manager. A pasted image has no path, so its first save asks where to
 * write.
 *
 * The `paste` event is used rather than a Cmd+V shortcut so the clipboard's
 * contents decide whether Pixen acts: anything that is not an image it can
 * open is left to whatever had focus.
 */
export const useClipboardPaste = ({ onOpenDataUrl, onReject }: ClipboardPasteHandlers) => {
  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const target = event.target instanceof HTMLElement ? event.target : null

      if (isTextEntryTarget(target)) {
        return
      }

      const file = pastedImage(event.clipboardData)

      if (!file) {
        if (hasUnsupportedImage(event.clipboardData)) {
          event.preventDefault()
          onReject('Pixen can open PNG, JPEG and WebP images.')
        }

        return
      }

      event.preventDefault()

      void readAsDataUrl(file)
        .then((dataUrl) => {
          onOpenDataUrl(dataUrl, file.name ? baseNameOf(file.name) : UNTITLED_NAME)
        })
        .catch((failure: unknown) => {
          onReject(toUserMessage(failure))
        })
    }

    window.addEventListener('paste', onPaste)

    return () => {
      window.removeEventListener('paste', onPaste)
    }
  }, [onOpenDataUrl, onReject])
}
