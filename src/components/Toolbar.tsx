import {
  Camera,
  Check,
  ChevronDown,
  Copy,
  FileDown,
  Grid2x2,
  ImagePlus,
  ListOrdered,
  Save,
  SaveAll,
  Wrench,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { useEffect, useId, useRef, useState } from 'react'

import { PixenLogo } from '@/components/shared/Icons'
import { APP_NAME, UNTITLED_NAME } from '@/lib/constants'
import type { SaveFormat } from '@/lib/image/image'
import { SAVE_FORMATS } from '@/lib/image/image'
import { isMacPlatform } from '@/lib/platform'
import { formatShortcut } from '@/lib/shortcuts'
import { cn } from '@/lib/utils'

interface ToolbarButtonProps {
  children: ReactNode
  className?: string
  disabled: boolean
  label: string
  primary?: boolean
  /** Omitted by actions that deliberately have no accelerator. */
  shortcut?: string
  onClick: () => void
}

const ToolbarButton = ({
  children,
  className,
  disabled,
  label,
  primary = false,
  shortcut,
  onClick,
}: ToolbarButtonProps) => {
  return (
    <button
      className={cn(
        'flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[12px] font-medium transition-colors disabled:pointer-events-none disabled:opacity-40',
        primary
          ? 'border-transparent bg-brand text-brand-foreground hover:brightness-110'
          : 'border-border bg-surface text-foreground hover:bg-accent',
        className,
      )}
      disabled={disabled}
      title={shortcut ? `${label} (${shortcut})` : label}
      type="button"
      onClick={onClick}
    >
      {children}
      {label}
    </button>
  )
}

interface ToolbarMenuProps {
  children: ReactNode
  disabled: boolean
  icon: ReactNode
  label: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * A toolbar-sized menu. The trigger matches the buttons beside it; the panel
 * is Pixen's own surface rather than a native select, so Tools and Export can
 * share one look.
 */
const ToolbarMenu = ({ children, disabled, icon, label, open, onOpenChange }: ToolbarMenuProps) => {
  const menuId = useId()
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) {
      return
    }

    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current?.contains(event.target as Node)) {
        return
      }

      onOpenChange(false)
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onOpenChange(false)
      }
    }

    // Pointer rather than click: a tool that opens an overlay must close this
    // menu before the overlay sees the same press.
    document.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)

    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [open, onOpenChange])

  return (
    <div ref={rootRef} className="relative">
      <button
        aria-controls={menuId}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 py-1.5 text-[12px] font-medium text-foreground transition-colors hover:bg-accent disabled:pointer-events-none disabled:opacity-40"
        disabled={disabled}
        title={label}
        type="button"
        onClick={() => onOpenChange(!open)}
      >
        {icon}
        {label}
        <ChevronDown className="size-3 text-muted-foreground" />
      </button>

      {open && (
        <div
          className="absolute top-[calc(100%+6px)] right-0 z-50 min-w-[176px] rounded-md border border-border bg-surface py-1 shadow-lg"
          id={menuId}
          role="menu"
        >
          {children}
        </div>
      )}
    </div>
  )
}

interface MenuItemProps {
  children: ReactNode
  disabled: boolean
  label: string
  shortcut?: string
  onClick: () => void
}

const MenuItem = ({ children, disabled, label, shortcut, onClick }: MenuItemProps) => {
  return (
    <button
      // Live because Copy answers by relabelling itself, which a screen reader
      // would otherwise never mention. Fixed labels never announce anything.
      aria-live="polite"
      className="flex w-full items-center gap-1.5 px-2.5 py-1.5 text-left text-[12px] font-medium text-foreground transition-colors hover:bg-accent disabled:pointer-events-none disabled:opacity-40"
      disabled={disabled}
      role="menuitem"
      title={shortcut ? `${label} (${shortcut})` : label}
      type="button"
      onClick={onClick}
    >
      {children}
      <span className="flex-1">{label}</span>
      {shortcut && <span className="text-[11px] text-muted-foreground">{shortcut}</span>}
    </button>
  )
}

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
  copied: boolean
  hasImage: boolean
  mac: boolean
  open: boolean
  onCaptureScreen?: () => void
  onCopyImage: () => void
  onIncrement: () => void
  onOpenChange: (open: boolean) => void
  onPixelize: () => void
}

const ToolsMenu = ({
  busy,
  copied,
  hasImage,
  mac,
  open,
  onCaptureScreen,
  onCopyImage,
  onIncrement,
  onOpenChange,
  onPixelize,
}: ToolsMenuProps) => {
  const close = () => onOpenChange(false)

  const items: ToolItem[] = [
    {
      label: copied ? 'Copied' : 'Copy',
      disabled: busy || !hasImage,
      icon: copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />,
      shortcut: formatShortcut(mac, 'c', true),
      // Stays open so the confirmation is visible, the same as when Copy was
      // a button on the bar.
      onSelect: onCopyImage,
    },
    {
      label: 'Pixelize',
      disabled: busy || !hasImage,
      icon: <Grid2x2 className="size-3.5" />,
      onSelect: () => {
        close()
        onPixelize()
      },
    },
    {
      label: 'Steps',
      disabled: busy || !hasImage,
      icon: <ListOrdered className="size-3.5" />,
      onSelect: () => {
        close()
        onIncrement()
      },
    },
  ]

  if (onCaptureScreen) {
    items.push({
      label: 'Screenshot',
      disabled: busy,
      icon: <Camera className="size-3.5" />,
      onSelect: () => {
        close()
        onCaptureScreen()
      },
    })
  }

  // Visible labels, not implementation names: "Copied" still belongs with Copy
  // so a confirmation does not shuffle the list.
  items.sort((left, right) => {
    const leftKey = left.label === 'Copied' ? 'Copy' : left.label
    const rightKey = right.label === 'Copied' ? 'Copy' : right.label

    return leftKey.localeCompare(rightKey)
  })

  return (
    <ToolbarMenu
      disabled={false}
      icon={<Wrench className="size-3.5" />}
      label="Tools"
      open={open}
      onOpenChange={onOpenChange}
    >
      {items.map((item) => (
        <MenuItem
          key={item.label === 'Copied' ? 'Copy' : item.label}
          disabled={item.disabled}
          label={item.label}
          shortcut={item.shortcut}
          onClick={item.onSelect}
        >
          {item.icon}
        </MenuItem>
      ))}
    </ToolbarMenu>
  )
}

interface ExportMenuProps {
  disabled: boolean
  format: SaveFormat
  open: boolean
  onChange: (format: SaveFormat) => void
  onOpenChange: (open: boolean) => void
}

/**
 * The format lives here rather than in the save dialog because a native dialog
 * reports only a path back, never which of its file types was picked.
 */
const ExportMenu = ({ disabled, format, open, onChange, onOpenChange }: ExportMenuProps) => {
  return (
    <ToolbarMenu
      disabled={disabled}
      icon={<FileDown className="size-3.5" />}
      label="Export"
      open={open}
      onOpenChange={onOpenChange}
    >
      {SAVE_FORMATS.map((option) => {
        const selected = option.id === format.id

        return (
          <MenuItem
            key={option.id}
            disabled={false}
            label={option.name}
            onClick={() => {
              onChange(option)
              onOpenChange(false)
            }}
          >
            <Check className={cn('size-3.5', selected ? 'opacity-100' : 'opacity-0')} />
          </MenuItem>
        )
      })}
    </ToolbarMenu>
  )
}

interface ToolbarProps {
  busy: boolean
  /** Shows the copy confirmation; the session clears it on its own. */
  copied: boolean
  dirty: boolean
  fileName: string | null
  format: SaveFormat
  hasImage: boolean
  /** Passed only where capture is supported, so the item is absent elsewhere. */
  onCaptureScreen?: () => void
  onCopyImage: () => void
  onPixelize: () => void
  onIncrement: () => void
  onFormatChange: (format: SaveFormat) => void
  onOpenImage: () => void
  onSave: () => void
  onSaveAs: () => void
}

export const Toolbar = ({
  busy,
  copied,
  dirty,
  fileName,
  format,
  hasImage,
  onCaptureScreen,
  onCopyImage,
  onPixelize,
  onIncrement,
  onFormatChange,
  onOpenImage,
  onSave,
  onSaveAs,
}: ToolbarProps) => {
  const mac = isMacPlatform()
  const [openMenu, setOpenMenu] = useState<'tools' | 'export' | null>(null)

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
        <ToolbarButton
          disabled={busy}
          label="Open Image"
          shortcut={formatShortcut(mac, 'o')}
          onClick={onOpenImage}
        >
          <ImagePlus className="size-3.5" />
        </ToolbarButton>

        <ToolbarButton
          disabled={busy || !hasImage}
          label="Save As"
          shortcut={formatShortcut(mac, 's', true)}
          onClick={onSaveAs}
        >
          <SaveAll className="size-3.5" />
        </ToolbarButton>

        <ToolbarButton
          disabled={busy || !hasImage}
          label="Save"
          shortcut={formatShortcut(mac, 's')}
          primary
          onClick={onSave}
        >
          <Save className="size-3.5" />
        </ToolbarButton>
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
          copied={copied}
          hasImage={hasImage}
          mac={mac}
          open={openMenu === 'tools'}
          onCaptureScreen={onCaptureScreen}
          onCopyImage={onCopyImage}
          onIncrement={onIncrement}
          onOpenChange={(open) => setOpenMenu(open ? 'tools' : null)}
          onPixelize={onPixelize}
        />

        <ExportMenu
          disabled={busy}
          format={format}
          open={openMenu === 'export'}
          onChange={onFormatChange}
          onOpenChange={(open) => setOpenMenu(open ? 'export' : null)}
        />
      </div>
    </header>
  )
}
