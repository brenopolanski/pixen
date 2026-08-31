import type { PointerEvent as ReactPointerEvent } from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import type { Rect } from '@/lib/image/pixelize'
import { rectBetween, selectionToPixels } from '@/lib/image/pixelize'

import { XIcon } from './shared/Icons'

interface PixelizeOverlayProps {
  /** The flattened canvas to select on. */
  image: string
  onApply: (region: Rect) => void
  onCancel: () => void
}

interface Drag {
  from: { x: number; y: number }
  to: { x: number; y: number }
}

/**
 * Covers the editor while a region is chosen.
 *
 * The selection is made here rather than on the editor's canvas because Unlayer
 * reports neither its zoom nor where the image sits on screen, so a box drawn
 * over the live canvas could not be mapped back to pixels. Showing a flattened
 * copy at a known scale makes the mapping exact.
 */
export const PixelizeOverlay = ({ image, onApply, onCancel }: PixelizeOverlayProps) => {
  const frameRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState<{ width: number; height: number } | null>(null)
  const [drag, setDrag] = useState<Drag | null>(null)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onCancel()
      }
    }

    window.addEventListener('keydown', onKeyDown, { capture: true })

    return () => {
      window.removeEventListener('keydown', onKeyDown, { capture: true })
    }
  }, [onCancel])

  /** Where the pointer is inside the frame the image is fitted into. */
  const pointIn = (event: ReactPointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect()

    return { x: event.clientX - bounds.left, y: event.clientY - bounds.top }
  }

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    // Captured so the drag keeps reporting after the pointer leaves the frame,
    // which is what lets a selection be dragged out to the very edge.
    event.currentTarget.setPointerCapture(event.pointerId)

    const point = pointIn(event)

    setDrag({ from: point, to: point })
  }

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag) {
      return
    }

    setDrag({ ...drag, to: pointIn(event) })
  }

  const handlePointerUp = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!drag) {
        return
      }

      const frame = frameRef.current
      const selection = rectBetween(drag.from, pointIn(event))

      setDrag(null)

      if (!frame || !size) {
        return
      }

      const region = selectionToPixels(
        { width: frame.clientWidth, height: frame.clientHeight },
        size,
        selection,
      )

      // A stray click, or a drag entirely in the letterbox margin, closes the
      // overlay rather than reporting an error the user cannot act on.
      if (!region) {
        onCancel()
        return
      }

      onApply(region)
    },
    [drag, onApply, onCancel, size],
  )

  const marquee = drag ? rectBetween(drag.from, drag.to) : null

  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-background fade-in">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-2.5">
        <p className="text-[12px] text-muted-foreground">
          Drag over anything private to hide it behind a mosaic.
          <span className="ml-2 text-muted-foreground/70">Esc to cancel</span>
        </p>

        <Button
          className="h-auto gap-1.5 px-2.5 py-1.5 text-[12px]"
          variant="outline"
          onClick={onCancel}
        >
          <XIcon className="size-3.5" />
          Cancel
        </Button>
      </div>

      <div
        ref={frameRef}
        className="relative min-h-0 flex-1 cursor-crosshair touch-none select-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        {/* `contain` is what displayedImageRect assumes; the two have to agree
            or every selection lands off by the letterbox. */}
        <img
          alt="The image being edited"
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

        {marquee && (
          <div
            className="pointer-events-none absolute border-2 border-brand bg-brand/25"
            style={{
              left: marquee.x,
              top: marquee.y,
              width: marquee.width,
              height: marquee.height,
            }}
          />
        )}
      </div>
    </div>
  )
}
