import { ImagePlus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { isMacPlatform } from '@/lib/platform'
import { formatShortcut } from '@/lib/shortcuts'

import { Logo } from './shared/Logo'
import { Kbd } from './ui/kbd'

interface EmptyStateProps {
  busy: boolean
  onOpenImage: () => void
}

export const EmptyState = ({ busy, onOpenImage }: EmptyStateProps) => {
  const mac = isMacPlatform()

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-8 text-center fade-in">
      <Logo className="size-16" />

      <div className="flex flex-col gap-1.5">
        <p className="text-[15px] font-semibold text-foreground">No image open</p>
        <p className="max-w-sm text-[13px] leading-relaxed text-muted-foreground">
          Drop a PNG, JPEG or WebP image here to start editing
        </p>
      </div>

      <Button className="h-auto px-3.5 py-2 text-[13px]" disabled={busy} onClick={onOpenImage}>
        <ImagePlus className="size-4" />
        Open Image
      </Button>

      <p className="text-[12px] text-muted-foreground">
        Use <Kbd>{formatShortcut(mac, 'o')}</Kbd> to browse and{' '}
        <Kbd>{formatShortcut(mac, 'v')}</Kbd> to paste from the clipboard
      </p>
    </div>
  )
}
