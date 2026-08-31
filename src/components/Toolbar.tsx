import {
  Camera,
  ChevronDown,
  Copy,
  FileDown,
  Grid2x2,
  ImagePlus,
  ListOrdered,
  Save,
  SaveAll,
  WandSparkles,
  Wrench,
} from 'lucide-react'
import type { ReactNode } from 'react'

import { PixenLogo } from '@/components/shared/Icons'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { APP_NAME, UNTITLED_NAME } from '@/lib/constants'
import type { SaveFormat } from '@/lib/image/image'
import { SAVE_FORMATS } from '@/lib/image/image'
import { isMacPlatform } from '@/lib/platform'
import { formatShortcut } from '@/lib/shortcuts'
import { generateReactKey } from '@/lib/utils'

/**
 * The primitives default to a 36px form control, which does not fit a 48px bar.
 * These are density overrides only — colour and state stay with the variants.
 */
const TOOLBAR_BUTTON = 'h-auto gap-1.5 px-2.5 py-1.5 text-[12px]'
const MENU_CONTENT = 'min-w-[176px]'
/** Icons in the menu read as part of their label, so they keep its colour. */
const MENU_ITEM = 'gap-1.5 px-2.5 py-1.5 text-[12px] font-medium [&_svg]:text-foreground'
/** No left padding: a checkbox item reserves that gutter for its checkmark. */
const MENU_CHECK_ITEM = 'gap-1.5 py-1.5 pr-2.5 text-[12px] font-medium'
const MENU_SHORTCUT = 'text-[11px] tracking-normal'

interface ToolItem {
  /** What the menu shows, and the key the list is sorted on. */
  label: string
  disabled: boolean
  icon: ReactNode
  shortcut?: string
  onSelect: () => void
}

interface ToolsMenuProps {
  busy: boolean
  hasImage: boolean
  mac: boolean
  onCaptureScreen?: () => void
  onCopyImage: () => void
  onCutout: () => void
  onIncrement: () => void
  onPixelize: () => void
}

const ToolsMenu = ({
  busy,
  hasImage,
  mac,
  onCaptureScreen,
  onCopyImage,
  onCutout,
  onIncrement,
  onPixelize,
}: ToolsMenuProps) => {
  const items: ToolItem[] = [
    {
      label: 'Background',
      disabled: busy || !hasImage,
      icon: <WandSparkles className="size-3.5" />,
      onSelect: onCutout,
    },
    {
      label: 'Copy',
      disabled: busy || !hasImage,
      icon: <Copy className="size-3.5" />,
      shortcut: formatShortcut(mac, 'c', true),
      // Confirmed by a toast from the session, so this closes like the rest:
      // the confirmation no longer needs the menu to stay open to be seen.
      onSelect: onCopyImage,
    },
    {
      label: 'Pixelize',
      disabled: busy || !hasImage,
      icon: <Grid2x2 className="size-3.5" />,
      onSelect: onPixelize,
    },
    {
      label: 'Steps',
      disabled: busy || !hasImage,
      icon: <ListOrdered className="size-3.5" />,
      onSelect: onIncrement,
    },
  ]

  if (onCaptureScreen) {
    items.push({
      label: 'Screenshot',
      disabled: busy,
      icon: <Camera className="size-3.5" />,
      onSelect: onCaptureScreen,
    })
  }

  // Sorted on what the user reads, so the order does not depend on which
  // optional tools are present.
  items.sort((left, right) => left.label.localeCompare(right.label))

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button className={TOOLBAR_BUTTON} title="Tools" variant="outline">
          <Wrench className="size-3.5" />
          Tools
          <ChevronDown className="size-3 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className={MENU_CONTENT} sideOffset={6}>
        {items.map((item) => (
          <DropdownMenuItem
            key={generateReactKey('tool', item.label)}
            className={MENU_ITEM}
            disabled={item.disabled}
            title={item.shortcut ? `${item.label} (${item.shortcut})` : item.label}
            onSelect={item.onSelect}
          >
            {item.icon}
            {item.label}
            {item.shortcut && (
              <DropdownMenuShortcut className={MENU_SHORTCUT}>{item.shortcut}</DropdownMenuShortcut>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

interface ExportMenuProps {
  disabled: boolean
  format: SaveFormat
  onChange: (format: SaveFormat) => void
}

/**
 * The format lives here rather than in the save dialog because a native dialog
 * reports only a path back, never which of its file types was picked.
 */
const ExportMenu = ({ disabled, format, onChange }: ExportMenuProps) => {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button className={TOOLBAR_BUTTON} disabled={disabled} title="Export" variant="outline">
          <FileDown className="size-3.5" />
          Export
          <ChevronDown className="size-3 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className={MENU_CONTENT} sideOffset={6}>
        {SAVE_FORMATS.map((option) => (
          <DropdownMenuCheckboxItem
            key={generateReactKey('format', option.id)}
            checked={option.id === format.id}
            className={MENU_CHECK_ITEM}
            title={option.name}
            onSelect={() => onChange(option)}
          >
            {option.name}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

interface ToolbarProps {
  busy: boolean
  dirty: boolean
  fileName: string | null
  format: SaveFormat
  hasImage: boolean
  /** Passed only where capture is supported, so the item is absent elsewhere. */
  onCaptureScreen?: () => void
  onCopyImage: () => void
  onCutout: () => void
  onPixelize: () => void
  onIncrement: () => void
  onFormatChange: (format: SaveFormat) => void
  onOpenImage: () => void
  onSave: () => void
  onSaveAs: () => void
}

export const Toolbar = ({
  busy,
  dirty,
  fileName,
  format,
  hasImage,
  onCaptureScreen,
  onCopyImage,
  onCutout,
  onPixelize,
  onIncrement,
  onFormatChange,
  onOpenImage,
  onSave,
  onSaveAs,
}: ToolbarProps) => {
  const mac = isMacPlatform()

  return (
    <header
      className="flex h-12 shrink-0 items-center gap-3 border-b border-border bg-surface px-3"
      data-tauri-drag-region
    >
      <div className="flex shrink-0 items-center gap-2">
        <PixenLogo className="size-5" />
        <span className="text-[13px] font-semibold tracking-tight text-foreground">{APP_NAME}</span>
      </div>

      {/* The file actions, next to the name they act on. */}
      <div className="flex shrink-0 items-center gap-1.5">
        <Button
          className={TOOLBAR_BUTTON}
          disabled={busy}
          title={`Open Image (${formatShortcut(mac, 'o')})`}
          variant="outline"
          onClick={onOpenImage}
        >
          <ImagePlus className="size-3.5" />
          Open Image
        </Button>

        <Button
          className={TOOLBAR_BUTTON}
          disabled={busy || !hasImage}
          title={`Save As (${formatShortcut(mac, 's', true)})`}
          variant="outline"
          onClick={onSaveAs}
        >
          <SaveAll className="size-3.5" />
          Save As
        </Button>

        <Button
          className={TOOLBAR_BUTTON}
          disabled={busy || !hasImage}
          title={`Save (${formatShortcut(mac, 's')})`}
          onClick={onSave}
        >
          <Save className="size-3.5" />
          Save
        </Button>
      </div>

      <div className="flex min-w-0 flex-1 items-center justify-center gap-1.5">
        <span className="truncate text-[12px] text-muted-foreground">
          {hasImage ? (fileName ?? UNTITLED_NAME) : 'No image open'}
        </span>
        {dirty && <span aria-label="Unsaved changes" className="size-1.5 rounded-full bg-brand" />}
      </div>

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
    </header>
  )
}
