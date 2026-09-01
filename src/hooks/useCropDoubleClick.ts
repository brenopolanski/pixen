import { useEffect } from 'react'

import { applyCropFromDoubleClick } from '@/lib/editor/crop'

/**
 * Unlayer has no apply-crop API. Double-clicking inside the box clicks the
 * Crop panel's close control, which is how the engine already commits the
 * crop (the same as switching tools). Captured on the way down so Cropper
 * cannot swallow the event.
 */
export const useCropDoubleClick = (containerId: string) => {
  useEffect(() => {
    const onDoubleClick = (event: MouseEvent) => {
      const root = document.getElementById(containerId)

      if (!root || !(event.target instanceof Node) || !root.contains(event.target)) {
        return
      }

      if (!applyCropFromDoubleClick(root, event.target)) {
        return
      }

      event.preventDefault()
      event.stopPropagation()
    }

    // On the document so a remounted editor container is still found, and
    // captured so Cropper cannot swallow the double-click.
    document.addEventListener('dblclick', onDoubleClick, { capture: true })

    return () => {
      document.removeEventListener('dblclick', onDoubleClick, { capture: true })
    }
  }, [containerId])
}
