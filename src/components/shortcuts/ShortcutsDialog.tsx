import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Kbd } from '@/components/ui/kbd'
import { Separator } from '@/components/ui/separator'
import { shortcutCatalog } from '@/lib/shortcuts'
import { generateReactKey } from '@/lib/utils'

interface ShortcutsDialogProps {
  open: boolean
  captureAccelerator: string
  onClose: () => void
}

export const ShortcutsDialog = ({ open, captureAccelerator, onClose }: ShortcutsDialogProps) => {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          onClose()
        }
      }}
    >
      <DialogContent className="sm:max-w-md" onOpenAutoFocus={(event) => event.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Keyboard Shortcuts</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {shortcutCatalog(captureAccelerator).map((entry, index) => (
            <section key={generateReactKey('shortcut-group', entry.group)} className="space-y-2">
              {index > 0 && <Separator />}
              <h3 className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                {entry.group}
              </h3>
              <ul className="space-y-1.5">
                {entry.items.map((item) => (
                  <li
                    key={generateReactKey('shortcut', item.keys)}
                    className="flex items-center justify-between gap-4 text-[13px]"
                  >
                    <span className="text-foreground">{item.action}</span>
                    <Kbd>{item.keys}</Kbd>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
