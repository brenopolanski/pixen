import { FolderOpen, ImagePlus } from 'lucide-react'

import { PixenLogo } from '@/components/shared/Icons'
import { isMacPlatform } from '@/lib/platform'
import { formatShortcut } from '@/lib/shortcuts'

interface EmptyStateProps {
  busy: boolean
  onOpenImage: () => void
  onOpenProject: () => void
}

export const EmptyState = ({ busy, onOpenImage, onOpenProject }: EmptyStateProps) => {
  const mac = isMacPlatform()

  return (
    <div className="fade-in flex flex-1 flex-col items-center justify-center gap-6 px-8 text-center">
      <PixenLogo className="size-16" />

      <div className="flex flex-col gap-1.5">
        <p className="text-[15px] font-semibold text-foreground">No image open</p>
        <p className="max-w-sm text-[13px] leading-relaxed text-muted-foreground">
          Open a PNG, JPEG or WebP image to start editing, or reopen a Pixen project you saved
          earlier.
        </p>
      </div>

      <div className="flex items-center gap-2">
        <button
          className="flex items-center gap-2 rounded-md bg-brand px-3.5 py-2 text-[13px] font-medium text-brand-foreground transition-[filter] hover:brightness-110 disabled:pointer-events-none disabled:opacity-40"
          disabled={busy}
          type="button"
          onClick={onOpenImage}
        >
          <ImagePlus className="size-4" />
          Open Image
        </button>

        <button
          className="flex items-center gap-2 rounded-md border border-border bg-surface px-3.5 py-2 text-[13px] font-medium text-foreground transition-colors hover:bg-accent disabled:pointer-events-none disabled:opacity-40"
          disabled={busy}
          type="button"
          onClick={onOpenProject}
        >
          <FolderOpen className="size-4" />
          Open Project
        </button>
      </div>

      <p className="text-[12px] text-muted-foreground">
        {formatShortcut(mac, 'o')} to open an image · {formatShortcut(mac, 's')} to save
      </p>
    </div>
  )
}
