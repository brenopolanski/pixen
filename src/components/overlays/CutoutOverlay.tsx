import type { CSSProperties } from 'react'
import { useCallback, useEffect, useState } from 'react'

import { CheckIcon, SparkleIcon, XIcon } from '@/components/shared/Icons'
import { Button } from '@/components/ui/button'
import { toUserMessage } from '@/lib/errors'
import { removeImageBackground } from '@/lib/image/cutout'
import { displayedImageRect } from '@/lib/image/pixelize'
import { generateReactKey } from '@/lib/utils'

const SPARKLE_COLOR = '#e4c441'

/** Fractions of the contained image, not the letterbox around it. */
const SPARKLES = [
  { x: 0.18, y: 0.22, size: 18, delay: '0s' },
  { x: 0.72, y: 0.16, size: 14, delay: '0s' },
  { x: 0.84, y: 0.38, size: 22, delay: '0s' },
  { x: 0.62, y: 0.48, size: 12, delay: '0s' },
  { x: 0.28, y: 0.58, size: 16, delay: '0s' },
  { x: 0.46, y: 0.74, size: 13, delay: '0s' },
  { x: 0.78, y: 0.78, size: 15, delay: '0s' },
  { x: 0.12, y: 0.8, size: 11, delay: '0s' },
] as const

const workingLabel = (ratio: number): string => {
  if (ratio <= 0) {
    return 'Starting…'
  }

  if (ratio < 1) {
    return `${Math.round(ratio * 100)}%`
  }

  return 'Working…'
}

interface CutoutOverlayProps {
  /** The flattened canvas to run the model on. */
  image: string
  onApply: (dataUrl: string) => void
  onCancel: () => void
  onDraftChange: (image: string | null) => void
  onError: (message: string) => void
}

/**
 * Runs background removal and shows the result before it is committed.
 *
 * An overlay rather than a single menu action because the model is a guess:
 * applying it reloads the editor and clears its undo, so a bad cutout has to be
 * refusable while the original is still intact.
 */
export const CutoutOverlay = ({
  image,
  onApply,
  onCancel,
  onDraftChange,
  onError,
}: CutoutOverlayProps) => {
  const [frame, setFrame] = useState<HTMLDivElement | null>(null)
  const [size, setSize] = useState<{ width: number; height: number } | null>(null)
  const [cutout, setCutout] = useState<string | null>(null)
  const [ratio, setRatio] = useState(0)

  /**
   * Reopening the tool mounts a fresh overlay on the same data URL, which the
   * webview already has decoded — so `load` can have fired before React
   * attached its handler, and the natural size has to be read off the element
   * instead of waited for.
   */
  const measure = useCallback((element: HTMLImageElement | null) => {
    if (element && element.complete && element.naturalWidth > 0) {
      setSize({ width: element.naturalWidth, height: element.naturalHeight })
    }
  }, [])

  useEffect(() => {
    let active = true
    const controller = new AbortController()

    setCutout(null)
    setRatio(0)

    const run = async () => {
      try {
        const result = await removeImageBackground(
          image,
          (next) => {
            if (active) {
              setRatio(next)
            }
          },
          controller.signal,
        )

        if (active) {
          setCutout(result)
        }
      } catch (failure) {
        // A run dropped from the queue rejects here with `active` already
        // false, so cancelling never reaches the banner.
        if (active) {
          // Reported through the session's banner rather than inside the
          // overlay: there is nothing left to do here, so the overlay closes
          // and the message outlives it.
          onError(toUserMessage(failure, 'Pixen could not remove the background.'))
          onCancel()
        }
      }
    }

    // Inference holds the thread for its whole run, so it is handed one frame
    // to let the original image and the wait UI reach the screen first.
    const frameId = requestAnimationFrame(() => {
      void run()
    })

    // Inference already inside WASM cannot be called back, so the abort only
    // drops a run that has not started. That is what keeps repeated cancels
    // from queueing a cutout each time, and keeps a finished one from writing
    // into a component that is gone.
    return () => {
      active = false
      controller.abort()
      cancelAnimationFrame(frameId)
    }
  }, [image, onCancel, onError])

  useEffect(() => {
    onDraftChange(cutout)

    return () => {
      onDraftChange(null)
    }
  }, [cutout, onDraftChange])

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
  const box = frame ? { width: frame.clientWidth, height: frame.clientHeight } : null
  const displayed = box && size ? displayedImageRect(box, size) : null
  const onPhoto = displayed !== null && displayed.width > 0
  // The whole frame until the picture has been measured, so the tool never
  // looks like it did nothing while the first frame is still being laid out.
  const waitStyle: CSSProperties = onPhoto
    ? { left: displayed.x, top: displayed.y, width: displayed.width, height: displayed.height }
    : { inset: 0 }

  return (
    <div aria-busy={!done} className="absolute inset-0 z-40 flex flex-col bg-background fade-in">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-2.5">
        <p className="text-[12px] text-muted-foreground">
          {done
            ? 'The checkerboard is what will be transparent. Save as PNG to keep it.'
            : 'Finding the subject. The first run also loads the model.'}
          <span className="ml-2 text-muted-foreground/70">Esc to cancel</span>
        </p>

        <div className="flex shrink-0 items-center gap-1.5">
          <Button
            className="h-auto gap-1.5 px-2.5 py-1.5 text-[12px]"
            variant="outline"
            onClick={onCancel}
          >
            <XIcon className="size-3.5" />
            Cancel
          </Button>

          <Button
            className="h-auto gap-1.5 px-2.5 py-1.5 text-[12px]"
            disabled={!done}
            onClick={apply}
          >
            <CheckIcon className="size-3.5" />
            Apply
          </Button>
        </div>
      </div>

      <div ref={setFrame} className="relative min-h-0 flex-1">
        {/* Only behind the result: showing it under the original would suggest
            the untouched image already has transparency. */}
        <div className={`absolute inset-0 ${done ? 'checkerboard' : ''}`}>
          <img
            ref={measure}
            alt={done ? 'The image with its background removed' : 'The image being processed'}
            className="absolute inset-0 size-full object-contain"
            draggable={false}
            src={cutout ?? image}
            onLoad={(event) => {
              setSize({
                width: event.currentTarget.naturalWidth,
                height: event.currentTarget.naturalHeight,
              })
            }}
          />
        </div>

        {!done && (
          <div
            className="pointer-events-none absolute overflow-hidden bg-black/40"
            style={waitStyle}
          >
            {/* Fractions of this layer, which is the picture once it has been
                measured and the whole frame until then — an image that will
                not decode must still look like something is happening. */}
            {SPARKLES.map((sparkle, index) => (
              <div
                key={generateReactKey('sparkle', index)}
                className="absolute"
                style={{
                  left: `${sparkle.x * 100}%`,
                  top: `${sparkle.y * 100}%`,
                  transform: 'translate(-50%, -50%)',
                }}
              >
                <SparkleIcon
                  className="twinkle block"
                  fill="currentColor"
                  stroke="none"
                  style={{
                    width: sparkle.size,
                    height: sparkle.size,
                    color: SPARKLE_COLOR,
                    animationDelay: sparkle.delay,
                  }}
                  aria-hidden
                />
              </div>
            ))}

            <div className="absolute inset-x-0 bottom-0 flex justify-center px-4 pb-4">
              {/* The fraction only covers loading the model. Inference reports
                  nothing, so a full load says Working rather than sitting on 100%. */}
              <p
                aria-live="polite"
                className="rounded-full bg-black/70 px-3 py-1 text-[12px] text-white"
              >
                {workingLabel(ratio)}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
