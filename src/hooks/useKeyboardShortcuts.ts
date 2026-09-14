import { useEffect } from 'react'

import {
  isArrowShortcut,
  isCopyImageShortcut,
  isCutoutShortcut,
  isOpenImageShortcut,
  isPixelizeShortcut,
  isRecordingCaptureShortcut,
  isSaveAsShortcut,
  isSaveShortcut,
  isStepsShortcut,
} from '@/lib/shortcuts'

interface ShortcutHandlers {
  hasImage: boolean
  onArrow: () => void
  onCopyImage: () => void
  onCutout: () => void
  onIncrement: () => void
  onOpenImage: () => void
  onPixelize: () => void
  onSave: () => void
  onSaveAs: () => void
}

export const useKeyboardShortcuts = ({
  hasImage,
  onArrow,
  onCopyImage,
  onCutout,
  onIncrement,
  onOpenImage,
  onPixelize,
  onSave,
  onSaveAs,
}: ShortcutHandlers) => {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isRecordingCaptureShortcut()) {
        return
      }

      if (isSaveShortcut(event)) {
        event.preventDefault()
        onSave()
        return
      }

      if (isSaveAsShortcut(event)) {
        event.preventDefault()
        onSaveAs()
        return
      }

      if (isOpenImageShortcut(event)) {
        event.preventDefault()
        onOpenImage()
        return
      }

      if (isCopyImageShortcut(event)) {
        event.preventDefault()
        onCopyImage()
        return
      }

      // Overlay tools only make sense with an image open. Swallowing the key
      // on the empty state would do nothing useful.
      if (!hasImage) {
        return
      }

      if (isArrowShortcut(event)) {
        event.preventDefault()
        onArrow()
        return
      }

      if (isPixelizeShortcut(event)) {
        event.preventDefault()
        onPixelize()
        return
      }

      if (isStepsShortcut(event)) {
        event.preventDefault()
        onIncrement()
        return
      }

      if (isCutoutShortcut(event)) {
        event.preventDefault()
        onCutout()
      }
    }

    // Captured on the way down so the editor cannot claim the keystroke first.
    window.addEventListener('keydown', onKeyDown, { capture: true })

    return () => {
      window.removeEventListener('keydown', onKeyDown, { capture: true })
    }
  }, [
    hasImage,
    onArrow,
    onCopyImage,
    onCutout,
    onIncrement,
    onOpenImage,
    onPixelize,
    onSave,
    onSaveAs,
  ])
}
