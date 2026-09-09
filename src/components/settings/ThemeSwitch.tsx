import { FancySwitch } from '@omit/react-fancy-switch'

import { MoonIcon, SunIcon } from '@/components/shared/Icons'
import type { EditorTheme } from '@/lib/settings'
import { cn } from '@/lib/utils'

interface ThemeSwitchProps {
  theme: EditorTheme
  onThemeChange: (theme: EditorTheme) => void
}

const OPTIONS: { label: string; value: EditorTheme }[] = [
  { label: 'Light', value: 'light' },
  { label: 'Dark', value: 'dark' },
]

export const ThemeSwitch = ({ theme, onThemeChange }: ThemeSwitchProps) => {
  return (
    <FancySwitch
      aria-label="Theme"
      className="relative isolate flex rounded-lg bg-muted p-1"
      highlighterClassName="rounded-md bg-brand"
      highlighterIncludeMargin={true}
      options={OPTIONS}
      radioClassName="relative z-10 flex size-8 cursor-pointer items-center justify-center rounded-md"
      renderOption={({ option, isSelected, getOptionProps }) => {
        const Icon = option.value === 'light' ? SunIcon : MoonIcon
        const { className, ...optionProps } = getOptionProps()

        return (
          <div
            className={cn(
              typeof className === 'string' ? className : undefined,
              isSelected ? 'text-brand-foreground' : 'text-muted-foreground',
            )}
            {...optionProps}
          >
            <Icon className="size-4" aria-hidden />
          </div>
        )
      }}
      value={theme}
      onChange={(value) => {
        onThemeChange(value as EditorTheme)
      }}
    />
  )
}
