import { X } from 'lucide-react'

interface ErrorBannerProps {
  message: string
  onDismiss: () => void
}

export const ErrorBanner = ({ message, onDismiss }: ErrorBannerProps) => {
  return (
    <div
      className="fade-in flex shrink-0 items-start gap-3 border-b border-border bg-danger-surface px-4 py-2.5"
      role="alert"
    >
      <p className="flex-1 text-[12px] leading-relaxed text-danger">{message}</p>

      <button
        aria-label="Dismiss"
        className="rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground"
        type="button"
        onClick={onDismiss}
      >
        <X className="size-3.5" />
      </button>
    </div>
  )
}
