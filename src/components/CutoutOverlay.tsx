import { Check, X } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { toUserMessage } from '@/lib/errors'
import { removeImageBackground } from '@/lib/image/cutout'

/** Matches the toolbar: an overlay is a mode of the same window, not a dialog. */
const OVERLAY_BUTTON = 'h-auto gap-1.5 px-2.5 py-1.5 text-[12px]'

interface CutoutOverlayProps {
  /** The flattened canvas to run the model on. */
  image: string
  onApply: (dataUrl: string) => void
  onCancel: () => void
  onError: (message: string) => void
}

/**
 * Runs background removal and shows the result before it is committed.
 *
 * An overlay rather than a single menu action because the model is a guess:
 * applying it reloads the editor and clears its undo, so a bad cutout has to be
 * refusable while the original is still intact.
 */
export const CutoutOverlay = ({ image, onApply, onCancel, onError }: CutoutOverlayProps) => {
  const [cutout, setCutout] = useState<string | null>(null)
  const [ratio, setRatio] = useState(0)

  useEffect(() => {
    let active = true

    const run = async () => {
      try {
        const result = await removeImageBackground(image, (next) => {
          if (active) {
            setRatio(next)
          }
        })

        if (active) {
          setCutout(result)
        }
      } catch (failure) {
        if (active) {
          // Reported through the session's banner rather than inside the
          // overlay: there is nothing left to do here, so the overlay closes
          // and the message outlives it.
          onError(toUserMessage(failure, 'Pixen could not remove the background.'))
          onCancel()
        }
      }
    }

    void run()

    // The library has no cancellation, so an overlay closed mid-run leaves
    // inference finishing in the background. This at least keeps it from
    // writing into a component that is gone.
    return () => {
      active = false
    }
  }, [image, onCancel, onError])

  const apply = useCallback(() => {
    if (cutout) {
      onApply(cutout)
    }
  }, [cutout, onApply])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onCancel()
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
  }, [apply, onCancel])

  const done = cutout !== null

  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-background fade-in">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-2.5">
        <p className="text-[12px] text-muted-foreground">
          {done
            ? 'The checkerboard is what will be transparent. Save as PNG to keep it.'
            : 'Finding the subject. The first run also loads the model.'}
          <span className="ml-2 text-muted-foreground/70">Esc to cancel</span>
        </p>

        <div className="flex shrink-0 items-center gap-1.5">
          <Button className={OVERLAY_BUTTON} variant="outline" onClick={onCancel}>
            <X className="size-3.5" />
            Cancel
          </Button>

          <Button className={OVERLAY_BUTTON} disabled={!done} onClick={apply}>
            <Check className="size-3.5" />
            Apply
          </Button>
        </div>
      </div>

      <div className="relative min-h-0 flex-1">
        {/* Only behind the result: showing it under the original would suggest
            the untouched image already has transparency. */}
        <div className={`absolute inset-0 ${done ? 'checkerboard' : ''}`}>
          <img
            alt={done ? 'The image with its background removed' : 'The image being processed'}
            className={`absolute inset-0 size-full object-contain transition-opacity ${
              done ? 'opacity-100' : 'opacity-40'
            }`}
            draggable={false}
            src={cutout ?? image}
          />
        </div>

        {!done && (
          <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-2.5 bg-gradient-to-t from-background to-transparent px-4 pt-10 pb-8">
            <div className="h-[3px] w-40 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-brand transition-[width] duration-200"
                style={{ width: `${Math.round(ratio * 100)}%` }}
              />
            </div>
            {/* The fraction only covers loading the model. Inference reports
                nothing, so a full bar says so rather than sitting on 100%. */}
            <p className="text-[11px] text-muted-foreground">
              {ratio <= 0 ? 'Starting…' : ratio < 1 ? `${Math.round(ratio * 100)}%` : 'Working…'}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
