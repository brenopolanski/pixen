import { Button } from '@/components/ui/button'

import { XIcon } from './shared/Icons'

interface ErrorBannerProps {
  message: string
  onDismiss: () => void
}

export const ErrorBanner = ({ message, onDismiss }: ErrorBannerProps) => {
  return (
    <div
      className="flex shrink-0 items-start gap-3 border-b border-border bg-danger-surface px-4 py-2.5 fade-in"
      role="alert"
    >
      <p className="flex-1 text-[12px] leading-relaxed text-danger">{message}</p>

      {/* The smallest icon size, because a full-size control would set the
          height of a banner that is one line of text tall. */}
      <Button
        aria-label="Dismiss"
        className="text-muted-foreground hover:text-foreground"
        size="icon-xs"
        variant="ghost"
        onClick={onDismiss}
      >
        <XIcon className="size-3.5" />
      </Button>
    </div>
  )
}
