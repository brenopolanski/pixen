import { ImageDown } from 'lucide-react'

/**
 * Covers the whole window while a drag is in progress. The editor fills the
 * window once an image is open, so an overlay is the only way to show the hint
 * over both it and the empty state.
 *
 * Purely a hint: the drop itself is handled by the window, not this element,
 * so it never takes pointer events.
 */
export const DropOverlay = () => {
  return (
    <div
      className="fade-in pointer-events-none absolute inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
      aria-hidden
    >
      <div className="flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-brand px-10 py-8">
        <ImageDown className="size-8 text-brand" />
        <p className="text-[14px] font-semibold text-foreground">Drop to open</p>
        <p className="text-[12px] text-muted-foreground">PNG, JPEG or WebP</p>
      </div>
    </div>
  )
}
