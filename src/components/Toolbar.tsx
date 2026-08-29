import { Camera, Check, ChevronDown, Copy, Grid2x2, ImagePlus, Save, SaveAll } from 'lucide-react'
import type { ChangeEvent, ReactNode } from 'react'

import { PixenLogo } from '@/components/shared/Icons'
import { APP_NAME, UNTITLED_NAME } from '@/lib/constants'
import type { SaveFormat } from '@/lib/image/image'
import { formatById, SAVE_FORMATS } from '@/lib/image/image'
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
      // Live because Copy answers by relabelling itself, which a screen reader
      // would otherwise never mention. Fixed labels never announce anything.
      aria-live="polite"
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

interface FormatSelectProps {
  disabled: boolean
  format: SaveFormat
  onChange: (format: SaveFormat) => void
}

/**
 * The format lives here rather than in the save dialog because a native dialog
 * reports only a path back, never which of its file types was picked.
 *
 * A plain select keeps the platform's own menu, keyboard handling and labelling
 * for free; the chevron is decorative and the arrow the browser draws is
 * dropped so the control matches the buttons beside it.
 */
const FormatSelect = ({ disabled, format, onChange }: FormatSelectProps) => {
  const handleChange = (event: ChangeEvent<HTMLSelectElement>) => {
    onChange(formatById(event.target.value))
  }

  return (
    <div className="relative flex items-center">
      <select
        aria-label="Save format"
        className="appearance-none rounded-md border border-border bg-surface py-1.5 pr-7 pl-2.5 text-[12px] font-medium text-foreground transition-colors hover:bg-accent disabled:pointer-events-none disabled:opacity-40"
        disabled={disabled}
        title="Format used when saving"
        value={format.id}
        onChange={handleChange}
      >
        {SAVE_FORMATS.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2 size-3 text-muted-foreground" />
    </div>
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
  /** Passed only where capture is supported, so the button is absent elsewhere. */
  onCaptureScreen?: () => void
  onCopyImage: () => void
  onPixelize: () => void
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
        {/* No accelerator: this opens a drag-to-select overlay rather than
            doing something a keystroke could finish on its own. */}
        <ToolbarButton disabled={busy || !hasImage} label="Pixelize" onClick={onPixelize}>
          <Grid2x2 className="size-3.5" />
        </ToolbarButton>

        {onCaptureScreen && (
          // No accelerator: Cmd+Shift+3/4/5 belong to macOS and shadowing them
          // would take the system capture away from the user.
          <ToolbarButton disabled={busy} label="Screenshot" onClick={onCaptureScreen}>
            <Camera className="size-3.5" />
          </ToolbarButton>
        )}

        <ToolbarButton
          // Held wide enough for the longer confirmation, so the row beside it
          // does not shift as the label changes.
          className="min-w-[90px] justify-center"
          disabled={busy || !hasImage}
          label={copied ? 'Copied' : 'Copy'}
          shortcut={formatShortcut(mac, 'c', true)}
          onClick={onCopyImage}
        >
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
        </ToolbarButton>

        {/* Belongs to the Save buttons on the left, not to the Copy beside it:
            the clipboard carries pixels, so the chosen format never applies. */}
        <FormatSelect disabled={busy} format={format} onChange={onFormatChange} />
      </div>
    </header>
  )
}
