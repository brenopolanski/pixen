import { useEffect } from 'react'

import {
  isCopyImageShortcut,
  isOpenImageShortcut,
  isSaveAsShortcut,
  isSaveShortcut,
} from '@/lib/shortcuts'

interface ShortcutHandlers {
  onCopyImage: () => void
  onOpenImage: () => void
  onSave: () => void
  onSaveAs: () => void
}

export const useKeyboardShortcuts = ({
  onCopyImage,
  onOpenImage,
  onSave,
  onSaveAs,
}: ShortcutHandlers) => {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
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
      }
    }

    // Captured on the way down so the editor cannot claim the keystroke first.
    window.addEventListener('keydown', onKeyDown, { capture: true })

    return () => {
      window.removeEventListener('keydown', onKeyDown, { capture: true })
    }
  }, [onCopyImage, onOpenImage, onSave, onSaveAs])
}
