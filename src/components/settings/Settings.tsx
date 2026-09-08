import { MoonIcon, SunIcon } from '@/components/shared/Icons'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Switch } from '@/components/ui/switch'
import type { EditorTheme } from '@/lib/settings'

interface SettingsProps {
  open: boolean
  theme: EditorTheme
  onClose: () => void
  onThemeChange: (theme: EditorTheme) => void
}

export const Settings = ({ open, theme, onClose, onThemeChange }: SettingsProps) => {
  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          onClose()
        }
      }}
    >
      <SheetContent className="w-full p-0 sm:max-w-md">
        <div className="flex h-full flex-col">
          <div className="px-6 pt-6">
            <SheetHeader className="p-0">
              <SheetTitle className="text-left">Settings</SheetTitle>
              <SheetDescription className="text-left">Configure appearance.</SheetDescription>
            </SheetHeader>
          </div>

          <div className="space-y-6 px-6 pt-8 pb-6">
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <span className="text-sm font-medium">Appearance</span>
                  <p className="text-xs text-muted-foreground">
                    Toggle between light and dark themes
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <SunIcon className="size-4 text-muted-foreground" />
                  <Switch
                    aria-label="Appearance"
                    checked={theme === 'dark'}
                    onCheckedChange={(dark) => onThemeChange(dark ? 'dark' : 'light')}
                  />
                  <MoonIcon className="size-4 text-muted-foreground" />
                </div>
              </div>
            </section>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
