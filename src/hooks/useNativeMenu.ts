import { useEffect, useRef } from 'react'

import type { AppMenu, MenuHandlers } from '@/lib/menu'
import { installAppMenu } from '@/lib/menu'
import { isMacPlatform } from '@/lib/platform'

/**
 * Builds the native menu once and keeps its enabled state in step with the
 * session.
 *
 * Building it once matters because installing a menu replaces the whole bar,
 * so the items call through a ref rather than closing over the handlers they
 * were created with.
 */
export const useNativeMenu = (handlers: MenuHandlers, hasImage: boolean) => {
  const handlersRef = useRef(handlers)
  const menuRef = useRef<AppMenu | null>(null)
  const hasImageRef = useRef(hasImage)

  useEffect(() => {
    handlersRef.current = handlers
    hasImageRef.current = hasImage
  }, [handlers, hasImage])

  useEffect(() => {
    let disposed = false

    void installAppMenu(isMacPlatform(), {
      onOpenImage: () => handlersRef.current.onOpenImage(),
      onCaptureScreen: () => handlersRef.current.onCaptureScreen(),
      onCopyImage: () => handlersRef.current.onCopyImage(),
      onArrow: () => handlersRef.current.onArrow(),
      onPixelize: () => handlersRef.current.onPixelize(),
      onIncrement: () => handlersRef.current.onIncrement(),
      onCutout: () => handlersRef.current.onCutout(),
      onSave: () => handlersRef.current.onSave(),
      onSaveAs: () => handlersRef.current.onSaveAs(),
      onAbout: () => handlersRef.current.onAbout(),
      onQuit: () => handlersRef.current.onQuit(),
    })
      .then(async (menu) => {
        if (disposed) {
          return
        }

        menuRef.current = menu

        // An image can already be open by the time the menu finishes building,
        // so the current state is applied rather than assumed empty.
        await menu.setHasImage(hasImageRef.current)
      })
      .catch((failure: unknown) => {
        console.error('[pixen] could not install the native menu', failure)
      })

    return () => {
      disposed = true
    }
  }, [])

  useEffect(() => {
    void menuRef.current?.setHasImage(hasImage)
  }, [hasImage])
}
