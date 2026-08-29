import { Check, Undo2, X } from 'lucide-react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { useCallback, useEffect, useState } from 'react'

import type { Stamp } from '@/lib/image/increment'
import { badgeRect, FIRST_STEP } from '@/lib/image/increment'
import { clickToPixel, displayedScale, pixelToDisplayed } from '@/lib/image/pixelize'

interface IncrementOverlayProps {
  /** The flattened canvas to stamp on. */
  image: string
  onApply: (stamps: Stamp[]) => void
  onCancel: () => void
}

/**
 * Numbers a screenshot the way a step-by-step guide wants it: click, and the
 * next digit lands there.
 *
 * The badges stay overlay elements until Done, so the counter can actually
 * count and the last one can be taken back. Baking each click straight into the
 * image would flatten the editor once per number and never get past 1.
 */
export const IncrementOverlay = ({ image, onApply, onCancel }: IncrementOverlayProps) => {
  const [frame, setFrame] = useState<HTMLDivElement | null>(null)
  const [size, setSize] = useState<{ width: number; height: number } | null>(null)
  const [stamps, setStamps] = useState<Stamp[]>([])

  const undoLast = useCallback(() => {
    setStamps((current) => current.slice(0, -1))
  }, [])

  const apply = useCallback(() => {
    if (stamps.length > 0) {
      onApply(stamps)
    }
  }, [onApply, stamps])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onCancel()
        return
      }

      if (event.key === 'Backspace') {
        event.preventDefault()
        undoLast()
        return
      }

      if (event.key === 'Enter') {
        event.preventDefault()
        apply()
      }
    }

    window.addEventListener('keydown', onKeyDown, { capture: true })

    return () => {
      window.removeEventListener('keydown', onKeyDown, { capture: true })
    }
  }, [apply, onCancel, undoLast])

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!size) {
      return
    }

    const bounds = event.currentTarget.getBoundingClientRect()
    const pixel = clickToPixel({ width: bounds.width, height: bounds.height }, size, {
      x: event.clientX - bounds.left,
      y: event.clientY - bounds.top,
    })

    // A click in the letterbox is ignored rather than closing the tool: the
    // user is mid-sequence and a miss should not cost them the numbers so far.
    if (!pixel) {
      return
    }

    setStamps((current) => [...current, { step: FIRST_STEP + current.length, ...pixel }])
  }

  const box = frame ? { width: frame.clientWidth, height: frame.clientHeight } : null
  // Badges are measured in image pixels, so on screen they shrink with the
  // image the same way the baked ones will.
  const scale = box && size ? displayedScale(box, size) : 1

  return (
    <div className="fade-in absolute inset-0 z-40 flex flex-col bg-background">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-2.5">
        <p className="text-[12px] text-muted-foreground">
          Click each spot in the order you want it numbered.
          <span className="ml-2 text-muted-foreground/70">Backspace undoes · Esc to cancel</span>
        </p>

        <div className="flex shrink-0 items-center gap-1.5">
          <button
            className="flex items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 py-1.5 text-[12px] font-medium text-foreground transition-colors hover:bg-accent disabled:pointer-events-none disabled:opacity-40"
            disabled={stamps.length === 0}
            type="button"
            onClick={undoLast}
          >
            <Undo2 className="size-3.5" />
            Undo last
          </button>

          <button
            className="flex items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 py-1.5 text-[12px] font-medium text-foreground transition-colors hover:bg-accent"
            type="button"
            onClick={onCancel}
          >
            <X className="size-3.5" />
            Cancel
          </button>

          {/* Nothing to bake until something has been stamped, and applying an
              empty set would flatten the editor for no change at all. */}
          <button
            className="flex items-center gap-1.5 rounded-md border border-transparent bg-brand px-2.5 py-1.5 text-[12px] font-medium text-brand-foreground transition-[filter] hover:brightness-110 disabled:pointer-events-none disabled:opacity-40"
            disabled={stamps.length === 0}
            type="button"
            onClick={apply}
          >
            <Check className="size-3.5" />
            Done
          </button>
        </div>
      </div>

      <div
        ref={setFrame}
        className="relative min-h-0 flex-1 cursor-crosshair touch-none select-none"
        onPointerDown={handlePointerDown}
      >
        {/* `contain` is what the geometry helpers assume; the two have to agree
            or every badge lands off by the letterbox. */}
        <img
          alt="The image being numbered"
          className="pointer-events-none absolute inset-0 size-full object-contain"
          draggable={false}
          src={image}
          onLoad={(event) => {
            setSize({
              width: event.currentTarget.naturalWidth,
              height: event.currentTarget.naturalHeight,
            })
          }}
        />

        {box &&
          size &&
          stamps.map((stamp) => {
            // The same rect the composite will use, so a badge nudged away from
            // an edge previews exactly where it lands.
            const rect = badgeRect(size, stamp)
            const origin = pixelToDisplayed(box, size, rect)
            const diameter = rect.width * scale

            return (
              <span
                key={stamp.step}
                className="pointer-events-none absolute flex items-center justify-center rounded-full bg-[#e5484d] font-semibold text-white"
                style={{
                  left: origin.x,
                  top: origin.y,
                  width: diameter,
                  height: diameter,
                  fontSize: diameter * 0.58,
                }}
              >
                {stamp.step}
              </span>
            )
          })}
      </div>
    </div>
  )
}
