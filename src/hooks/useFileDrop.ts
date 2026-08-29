import { useEffect, useState } from 'react'

import { onFileDrop } from '@/lib/desktop'
import { firstSupportedImagePath } from '@/lib/image/image'

interface FileDropHandlers {
  onOpenPath: (path: string) => void
  onReject: (message: string) => void
}

/**
 * Opens an image dropped anywhere on the window.
 *
 * Returns whether a drag is currently over the window so the UI can say that
 * dropping will do something — Tauri gives no paths until the drop itself, so
 * the hint cannot name the file or promise it is supported.
 */
export const useFileDrop = ({ onOpenPath, onReject }: FileDropHandlers): boolean => {
  const [dragging, setDragging] = useState(false)

  useEffect(() => {
    let disposed = false
    let unlisten: (() => void) | undefined

    void onFileDrop(
      (state) => {
        if (!disposed) {
          setDragging(state === 'over')
        }
      },
      (paths) => {
        if (disposed) {
          return
        }

        const path = firstSupportedImagePath(paths)

        if (path) {
          onOpenPath(path)
          return
        }

        // Matches the wording read_image uses when it refuses a file.
        onReject('Pixen can open PNG, JPEG and WebP images.')
      },
    )
      .then((stop) => {
        if (disposed) {
          stop()
          return
        }

        unlisten = stop
      })
      .catch((failure: unknown) => {
        console.error('[pixen] could not listen for dropped files', failure)
      })

    return () => {
      disposed = true
      unlisten?.()
    }
  }, [onOpenPath, onReject])

  return dragging
}
