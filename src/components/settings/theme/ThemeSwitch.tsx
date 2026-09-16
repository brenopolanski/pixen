import { MoonIcon, SunIcon } from '@/components/shared/Icons'
import type { EditorTheme } from '@/lib/settings'
import { cn, generateReactKey } from '@/lib/utils'

interface ThemeSwitchProps {
  theme: EditorTheme
  onThemeChange: (theme: EditorTheme) => void
}

const THEMES: { id: EditorTheme; label: string; icon: typeof SunIcon }[] = [
  { id: 'light', label: 'Light', icon: SunIcon },
  { id: 'dark', label: 'Dark', icon: MoonIcon },
]

export const ThemeSwitch = ({ theme, onThemeChange }: ThemeSwitchProps) => {
  return (
    <div
      aria-label="Theme"
      className="flex shrink-0 gap-0.5 rounded-lg bg-muted p-0.5"
      role="radiogroup"
    >
      {THEMES.map(({ id, icon: Icon, label }) => (
        <button
          key={generateReactKey('theme', id)}
          aria-checked={theme === id}
          aria-label={label}
          className={cn(
            'grid size-7 place-items-center rounded-md transition-colors',
            theme === id
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
          role="radio"
          type="button"
          onClick={() => {
            onThemeChange(id)
          }}
        >
          <Icon className="size-4" />
        </button>
      ))}
    </div>
  )
}
