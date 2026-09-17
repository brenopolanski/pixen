import { XIcon } from '@/components/shared/Icons'
import { Button } from '@/components/ui/button'

interface ErrorBannerProps {
  message: string
  onDismiss: () => void
}

export const ErrorBanner = ({ message, onDismiss }: ErrorBannerProps) => {
  return (
    <div
      className="flex shrink-0 items-center gap-3 border-b border-border bg-danger-surface px-4 py-2.5 fade-in"
      role="alert"
    >
      <p className="flex-1 text-[12px] leading-relaxed text-danger">{message}</p>
      <Button
        aria-label="Dismiss"
        className="self-start text-muted-foreground hover:text-foreground"
        size="icon-xs"
        variant="ghost"
        onClick={onDismiss}
      >
        <XIcon className="size-3.5" />
      </Button>
    </div>
  )
}
