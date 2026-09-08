import { useCallback, useEffect, useState } from 'react'

import type { EditorTheme, PixenSettings } from '@/lib/settings'
import { applyDocumentTheme, readSettings, writeSettings } from '@/lib/settings'

export const useEditorSettings = () => {
  const [settings, setSettings] = useState<PixenSettings>(readSettings)

  useEffect(() => {
    applyDocumentTheme(settings.theme)
  }, [settings.theme])

  const setTheme = useCallback((theme: EditorTheme) => {
    setSettings((current) => {
      const next = { ...current, theme }

      writeSettings(next)
      return next
    })
  }, [])

  return { theme: settings.theme, setTheme }
}
