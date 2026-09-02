import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import type { EditorTheme } from '@/lib/settings'
import { cn } from '@/lib/utils'

interface SettingsProps {
  open: boolean
  theme: EditorTheme
  onClose: () => void
  onThemeChange: (theme: EditorTheme) => void
}

const THEMES: { id: EditorTheme; label: string }[] = [
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
]

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
              <div className="space-y-0.5">
                <span className="text-sm font-medium">Appearance</span>
                <p className="text-xs text-muted-foreground">
                  Light or dark chrome for Pixen and the image editor.
                </p>
              </div>

              <div className="flex gap-2">
                {THEMES.map((option) => {
                  const selected = option.id === theme

                  return (
                    <button
                      key={option.id}
                      className={cn(
                        'flex-1 rounded-md border px-3 py-2 text-[12px] font-medium',
                        selected
                          ? 'border-border bg-accent text-foreground'
                          : 'border-transparent text-muted-foreground hover:bg-accent/60',
                      )}
                      type="button"
                      onClick={() => onThemeChange(option.id)}
                    >
                      {option.label}
                    </button>
                  )
                })}
              </div>
            </section>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
