import type { EditorTheme } from '@/lib/settings'

import { ThemeSwitch } from './ThemeSwitch'

interface ThemeSettingsProps {
  theme: EditorTheme
  onThemeChange: (theme: EditorTheme) => void
}

export const ThemeSettings = ({ theme, onThemeChange }: ThemeSettingsProps) => {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <span className="text-sm font-medium">Appearance</span>
          <p className="text-xs text-muted-foreground">Toggle between light and dark themes</p>
        </div>

        <ThemeSwitch theme={theme} onThemeChange={onThemeChange} />
      </div>
    </div>
  )
}
