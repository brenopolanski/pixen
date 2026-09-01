import { ImagePlusIcon, SaveAllIcon, SaveIcon } from '@/components/shared/Icons'
import { Logo } from '@/components/shared/Logo'
import { Button } from '@/components/ui/button'
import { APP_NAME } from '@/lib/constants'
import type { SaveFormat } from '@/lib/image/image'
import { isMacPlatform } from '@/lib/platform'
import { formatShortcut } from '@/lib/shortcuts'
import type { ImageTab } from '@/lib/tabs'

import { ExportMenu } from './ExportMenu'
import { TabBar } from './TabBar'
import { ToolsMenu } from './ToolsMenu'

interface ToolbarProps {
  busy: boolean
  format: SaveFormat
  hasImage: boolean
  tabs: ImageTab[]
  activeId: string | null
  overlayOpen: boolean
  /** Passed only where capture is supported, so the item is absent elsewhere. */
  onCaptureScreen?: () => void
  onCopyImage: () => void
  onCutout: () => void
  onPixelize: () => void
  onIncrement: () => void
  onFormatChange: (format: SaveFormat) => void
  onOpenImage: () => void
  onOpenNewTab: () => void
  onActivateTab: (tabId: string) => void
  onCloseTab: (tabId: string) => void
  onSave: () => void
  onSaveAs: () => void
}

export const Toolbar = ({
  busy,
  format,
  hasImage,
  tabs,
  activeId,
  overlayOpen,
  onCaptureScreen,
  onCopyImage,
  onCutout,
  onPixelize,
  onIncrement,
  onFormatChange,
  onOpenImage,
  onOpenNewTab,
  onActivateTab,
  onCloseTab,
  onSave,
  onSaveAs,
}: ToolbarProps) => {
  const mac = isMacPlatform()

  return (
    <header className="shrink-0 border-b border-border bg-surface">
      <div className="flex h-12 items-center gap-3 px-3" data-tauri-drag-region>
        <div className="flex shrink-0 items-center gap-2">
          <Logo className="size-5" />
          <span className="text-[13px] font-semibold tracking-tight text-foreground">
            {APP_NAME}
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <Button
            className="h-auto gap-1.5 px-2.5 py-1.5 text-[12px]"
            disabled={busy}
            title={`Open Image (${formatShortcut(mac, 'o')})`}
            variant="outline"
            onClick={onOpenImage}
          >
            <ImagePlusIcon className="size-3.5" />
            Open Image
          </Button>

          <Button
            className="h-auto gap-1.5 px-2.5 py-1.5 text-[12px]"
            disabled={busy || !hasImage}
            title={`Save As (${formatShortcut(mac, 's', true)})`}
            variant="outline"
            onClick={onSaveAs}
          >
            <SaveAllIcon className="size-3.5" />
            Save As
          </Button>

          <Button
            className="h-auto gap-1.5 px-2.5 py-1.5 text-[12px]"
            disabled={busy || !hasImage}
            title={`Save (${formatShortcut(mac, 's')})`}
            onClick={onSave}
          >
            <SaveIcon className="size-3.5" />
            Save
          </Button>
        </div>

        <div className="min-w-0 flex-1" />

        <div className="flex shrink-0 items-center gap-1.5">
          <ToolsMenu
            busy={busy}
            hasImage={hasImage}
            mac={mac}
            onCaptureScreen={onCaptureScreen}
            onCopyImage={onCopyImage}
            onCutout={onCutout}
            onIncrement={onIncrement}
            onPixelize={onPixelize}
          />

          <ExportMenu disabled={busy} format={format} onChange={onFormatChange} />
        </div>
      </div>

      <TabBar
        activeId={activeId}
        locked={busy || overlayOpen}
        tabs={tabs}
        onActivate={onActivateTab}
        onClose={onCloseTab}
        onNewTab={onOpenNewTab}
      />
    </header>
  )
}
