export type EditorTheme = 'light' | 'dark'

export interface PixenSettings {
  theme: EditorTheme
}

export const SETTINGS_STORAGE_KEY = 'pixen.settings'

export const DEFAULT_SETTINGS: PixenSettings = {
  theme: 'dark',
}

const isEditorTheme = (value: unknown): value is EditorTheme => {
  return value === 'light' || value === 'dark'
}

/**
 * Turns a stored JSON string into settings. Missing or unknown fields fall
 * back so a future key, or a corrupted write, cannot break the editor.
 */
export const parseSettings = (raw: string | null): PixenSettings => {
  if (!raw) {
    return { ...DEFAULT_SETTINGS }
  }

  try {
    const parsed: unknown = JSON.parse(raw)

    if (!parsed || typeof parsed !== 'object') {
      return { ...DEFAULT_SETTINGS }
    }

    const theme = 'theme' in parsed ? parsed.theme : undefined

    return {
      theme: isEditorTheme(theme) ? theme : DEFAULT_SETTINGS.theme,
    }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export const readSettings = (): PixenSettings => {
  try {
    return parseSettings(localStorage.getItem(SETTINGS_STORAGE_KEY))
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export const writeSettings = (settings: PixenSettings): void => {
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings))
  } catch {
    // Private mode or a full quota must not break the editor.
  }
}

/** Puts `.dark` on `<html>` so chrome tokens follow the stored theme. */
export const applyDocumentTheme = (theme: EditorTheme): void => {
  document.documentElement.classList.toggle('dark', theme === 'dark')
}
