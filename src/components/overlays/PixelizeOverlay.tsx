import type { PointerEvent as ReactPointerEvent } from 'react'
import { useCallback, useEffect, useState } from 'react'

import { CheckIcon, Undo2Icon, XIcon } from '@/components/shared/Icons'
import { Button } from '@/components/ui/button'
import { useOverlayFrame } from '@/hooks/useOverlayFrame'
import { clampPixel } from '@/lib/image/arrow'
import type { Rect } from '@/lib/image/pixelize'
import {
  clickToPixel,
  displayedScale,
  hitTestRect,
  pixelToDisplayed,
  rectBetween,
  selectionToPixels,
  translateRect,
} from '@/lib/image/pixelize'
import { generateReactKey } from '@/lib/utils'

interface PixelizeOverlayProps {
  /** The flattened canvas to select on. */
  image: string
  onApply: (regions: Rect[]) => void
  onCancel: () => void
  onDraftChange: (regions: Rect[]) => void
}

interface Drag {
  from: { x: number; y: number }
  to: { x: number; y: number }
}

/**
 * Covers the editor while regions are chosen.
 *
 * The selection is made here rather than on the editor's canvas because Unlayer
 * reports neither its zoom nor where the image sits on screen, so a box drawn
 * over the live canvas could not be mapped back to pixels. Showing a flattened
 * copy at a known scale makes the mapping exact.
 *
 * Boxes stay overlay marquees until Done, so more than one area can be hidden
 * in a single flatten.
 */
export const PixelizeOverlay = ({
  image,
  onApply,
  onCancel,
  onDraftChange,
}: PixelizeOverlayProps) => {
  const { box, setFrame } = useOverlayFrame()
  const [size, setSize] = useState<{ width: number; height: number } | null>(null)
  const [regions, setRegions] = useState<Rect[]>([])
  const [selected, setSelected] = useState<number | null>(null)
  const [moving, setMoving] = useState<{
    index: number
    origin: { x: number; y: number }
    rect: Rect
  } | null>(null)
  const [drag, setDrag] = useState<Drag | null>(null)

  useEffect(() => {
    onDraftChange(regions)
  }, [onDraftChange, regions])

  const undoLast = useCallback(() => {
    setSelected((index) => (index === regions.length - 1 ? null : index))
    setRegions((current) => current.slice(0, -1))
  }, [regions.length])

  const deleteSelected = useCallback(() => {
    if (selected === null) {
      undoLast()
      return
    }

    setRegions((current) => current.filter((_, index) => index !== selected))
    setSelected(null)
  }, [selected, undoLast])

  const apply = useCallback(() => {
    if (regions.length > 0) {
      onApply(regions)
    }
  }, [onApply, regions])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onCancel()
        return
      }

      if (event.key === 'Backspace') {
        event.preventDefault()
        deleteSelected()
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
  }, [apply, deleteSelected, onCancel])

  const scale = box && size ? displayedScale(box, size) : 1

  /** Where the pointer is inside the frame the image is fitted into. */
  const pointIn = (event: ReactPointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect()

    return { x: event.clientX - bounds.left, y: event.clientY - bounds.top }
  }

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!box || !size) {
      return
    }

    // Captured so the drag keeps reporting after the pointer leaves the frame,
    // which is what lets a selection be dragged out to the very edge.
    event.currentTarget.setPointerCapture(event.pointerId)

    const point = pointIn(event)
    const pixel = clickToPixel(box, size, point)

    if (pixel) {
      const hit = hitTestRect(regions, pixel)

      if (hit !== null) {
        const rect = regions[hit]

        if (!rect) {
          return
        }

        setSelected(hit)
        setDrag(null)
        setMoving({ index: hit, origin: pixel, rect })
        return
      }
    }

    setSelected(null)
    setMoving(null)
    setDrag({ from: point, to: point })
  }

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!box || !size) {
      return
    }

    if (moving) {
      const pixel = clampPixel(box, size, pointIn(event))
      const next = translateRect(
        moving.rect,
        { x: pixel.x - moving.origin.x, y: pixel.y - moving.origin.y },
        size,
      )

      setRegions((current) => current.map((rect, index) => (index === moving.index ? next : rect)))
      return
    }

    if (!drag) {
      return
    }

    setDrag({ ...drag, to: pointIn(event) })
  }

  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (moving) {
      setMoving(null)
      return
    }

    if (!drag || !box || !size) {
      setDrag(null)
      return
    }

    const selection = rectBetween(drag.from, pointIn(event))

    setDrag(null)

    const region = selectionToPixels(box, size, selection)

    // A stray click, or a drag entirely in the letterbox margin, is dropped
    // rather than closing the tool: the user is mid-sequence.
    if (region) {
      setRegions((current) => [...current, region])
    }
  }

  const marquee = drag ? rectBetween(drag.from, drag.to) : null

  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-background fade-in">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-2.5">
        <p className="text-[12px] text-muted-foreground">
          Drag over anything private to pixelate it.
          <span className="ml-2 text-muted-foreground/70">Esc to cancel</span>
        </p>

        <div className="flex shrink-0 items-center gap-1.5">
          <Button
            className="h-auto gap-1.5 px-2.5 py-1.5 text-[12px]"
            disabled={regions.length === 0}
            variant="outline"
            onClick={undoLast}
          >
            <Undo2Icon className="size-3.5" />
            Undo last
          </Button>

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
            disabled={regions.length === 0}
            onClick={apply}
          >
            <CheckIcon className="size-3.5" />
            Done
          </Button>
        </div>
      </div>

      <div
        ref={setFrame}
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

        {box &&
          size &&
          regions.map((region, index) => {
            const origin = pixelToDisplayed(box, size, region)

            return (
              <div
                key={generateReactKey('pixelize', index)}
                className="pointer-events-none absolute border-2 border-brand bg-brand/25"
                style={{
                  left: origin.x,
                  top: origin.y,
                  width: region.width * scale,
                  height: region.height * scale,
                  boxShadow: index === selected ? `0 0 0 ${4 * scale}px white` : undefined,
                }}
              />
            )
          })}

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
