import { FolderOpen, ImagePlus, Save, SaveAll } from 'lucide-react'
import type { ReactNode } from 'react'

import { PixenLogo } from '@/components/shared/Icons'
import { APP_NAME, UNTITLED_PROJECT_NAME } from '@/lib/constants'
import { isMacPlatform } from '@/lib/platform'
import { formatShortcut } from '@/lib/shortcuts'
import { cn } from '@/lib/utils'

interface ToolbarButtonProps {
  children: ReactNode
  disabled: boolean
  label: string
  primary?: boolean
  shortcut: string
  onClick: () => void
}

const ToolbarButton = ({
  children,
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
      )}
      disabled={disabled}
      title={`${label} (${shortcut})`}
      type="button"
      onClick={onClick}
    >
      {children}
      {label}
    </button>
  )
}

interface ToolbarProps {
  busy: boolean
  dirty: boolean
  fileName: string | null
  hasProject: boolean
  onOpenImage: () => void
  onOpenProject: () => void
  onSave: () => void
  onSaveAs: () => void
}

export const Toolbar = ({
  busy,
  dirty,
  fileName,
  hasProject,
  onOpenImage,
  onOpenProject,
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

      <div className="flex min-w-0 flex-1 items-center justify-center gap-1.5">
        <span className="truncate text-[12px] text-muted-foreground">
          {hasProject ? (fileName ?? UNTITLED_PROJECT_NAME) : 'No image open'}
        </span>
        {dirty && <span aria-label="Unsaved changes" className="size-1.5 rounded-full bg-brand" />}
      </div>

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
          disabled={busy}
          label="Open Project"
          shortcut={formatShortcut(mac, 'o', true)}
          onClick={onOpenProject}
        >
          <FolderOpen className="size-3.5" />
        </ToolbarButton>

        <ToolbarButton
          disabled={busy || !hasProject}
          label="Save As"
          shortcut={formatShortcut(mac, 's', true)}
          onClick={onSaveAs}
        >
          <SaveAll className="size-3.5" />
        </ToolbarButton>

        <ToolbarButton
          disabled={busy || !hasProject}
          label="Save"
          shortcut={formatShortcut(mac, 's')}
          primary
          onClick={onSave}
        >
          <Save className="size-3.5" />
        </ToolbarButton>
      </div>
    </header>
  )
}
