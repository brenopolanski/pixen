import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import type { EditorTheme } from '@/lib/settings'

import { CaptureSettings } from './capture/CaptureSettings'
import { ThemeSettings } from './theme/ThemeSettings'

interface SettingsProps {
  open: boolean
  theme: EditorTheme
  captureAccelerator: string
  onClose: () => void
  onThemeChange: (theme: EditorTheme) => void
  onRebindCapture: (accelerator: string) => Promise<string | null>
}

export const Settings = ({
  open,
  theme,
  captureAccelerator,
  onClose,
  onThemeChange,
  onRebindCapture,
}: SettingsProps) => {
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
              <SheetDescription className="text-left">
                Configure your app preferences
              </SheetDescription>
            </SheetHeader>
          </div>

          <ScrollArea className="min-h-0 flex-1">
            <div className="space-y-6 px-6 pt-8 pb-6">
              <section>
                <ThemeSettings theme={theme} onThemeChange={onThemeChange} />
              </section>

              <Separator />

              <section>
                <CaptureSettings
                  captureAccelerator={captureAccelerator}
                  onRebindCapture={onRebindCapture}
                />
              </section>
            </div>
          </ScrollArea>
        </div>
      </SheetContent>
    </Sheet>
  )
}
