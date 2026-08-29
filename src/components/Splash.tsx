import { PixenLogo } from '@/components/shared/Icons'
import { APP_NAME, APP_TAGLINE } from '@/lib/constants'

export const Splash = () => {
  return (
    <div
      className="flex h-full flex-col items-center justify-center gap-5 rounded-xl border border-white/10 bg-background shadow-2xl fade-in"
      data-tauri-drag-region
    >
      <PixenLogo className="size-14" />

      <div className="flex flex-col items-center gap-1">
        <p className="text-[17px] font-semibold tracking-tight text-foreground">{APP_NAME}</p>
        <p className="text-[13px] text-muted-foreground">{APP_TAGLINE}</p>
      </div>

      <div className="flex flex-col items-center gap-2.5">
        <div className="h-[3px] w-28 overflow-hidden rounded-full bg-muted">
          <div className="progress-indicator h-full w-1/3 rounded-full bg-brand" />
        </div>
        <p className="text-[11px] text-muted-foreground">Loading…</p>
      </div>
    </div>
  )
}
