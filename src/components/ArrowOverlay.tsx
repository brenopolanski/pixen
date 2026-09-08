import type { PointerEvent as ReactPointerEvent } from 'react'
import { useCallback, useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import type { Arrow } from '@/lib/image/arrow'
import {
  ARROW_COLOR,
  ARROW_STROKE,
  arrowOutline,
  clampPixel,
  isUsableArrow,
} from '@/lib/image/arrow'
import { clickToPixel, displayedScale, pixelToDisplayed } from '@/lib/image/pixelize'
import { generateReactKey } from '@/lib/utils'

import { CheckIcon, Undo2Icon, XIcon } from './shared/Icons'

interface ArrowOverlayProps {
  /** The flattened canvas to draw on. */
  image: string
  onApply: (arrows: Arrow[]) => void
  onCancel: () => void
}

/**
 * Points at things the way a tutorial wants: drag from somewhere clear to the
 * thing itself, and the head lands where you let go.
 *
 * Like the numbering tool, the arrows stay overlay elements until Done, so the
 * last one can be taken back and the editor is flattened once rather than once
 * per arrow.
 */
export const ArrowOverlay = ({ image, onApply, onCancel }: ArrowOverlayProps) => {
  const [frame, setFrame] = useState<HTMLDivElement | null>(null)
  const [size, setSize] = useState<{ width: number; height: number } | null>(null)
  const [arrows, setArrows] = useState<Arrow[]>([])
  const [drawing, setDrawing] = useState<Arrow | null>(null)

  const undoLast = useCallback(() => {
    setArrows((current) => current.slice(0, -1))
  }, [])

  const apply = useCallback(() => {
    if (arrows.length > 0) {
      onApply(arrows)
    }
  }, [arrows, onApply])

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

  const box = frame ? { width: frame.clientWidth, height: frame.clientHeight } : null
  // Arrows are measured in image pixels, so on screen they thin out with the
  // image exactly as the baked ones will.
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

    // The tail is refused in the letterbox rather than clamped: starting off
    // the picture is a miss, and a miss should not cost the arrows so far.
    const tail = clickToPixel(box, size, pointIn(event))

    if (!tail) {
      return
    }

    // Captured so the drag keeps reporting after the pointer leaves the frame,
    // which is what lets an arrow be aimed at the very edge.
    event.currentTarget.setPointerCapture(event.pointerId)
    setDrawing({ from: tail, to: tail })
  }

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!drawing || !box || !size) {
      return
    }

    setDrawing({ ...drawing, to: clampPixel(box, size, pointIn(event)) })
  }

  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!drawing || !box || !size) {
      return
    }

    const arrow = { ...drawing, to: clampPixel(box, size, pointIn(event)) }

    setDrawing(null)

    // A tap rather than a drag leaves the overlay open: the user is mid-guide,
    // and an arrow too short to point anywhere is not worth keeping.
    if (isUsableArrow(arrow)) {
      setArrows((current) => [...current, arrow])
    }
  }

  /** An arrow in image pixels, as the SVG overlay has to place it. */
  const displayed = (arrow: Arrow) => {
    if (!box || !size) {
      return null
    }

    const outline = arrowOutline(arrow)

    if (!outline) {
      return null
    }

    return {
      tail: pixelToDisplayed(box, size, arrow.from),
      tip: pixelToDisplayed(box, size, arrow.to),
      shaftEnd: pixelToDisplayed(box, size, outline.shaftEnd),
      left: pixelToDisplayed(box, size, outline.left),
      right: pixelToDisplayed(box, size, outline.right),
    }
  }

  const preview = [...arrows, ...(drawing ? [drawing] : [])]

  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-background fade-in">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-2.5">
        <p className="text-[12px] text-muted-foreground">
          Drag from open space towards whatever the reader should look at.
          <span className="ml-2 text-muted-foreground/70">Backspace undoes · Esc to cancel</span>
        </p>

        <div className="flex shrink-0 items-center gap-1.5">
          <Button
            className="h-auto gap-1.5 px-2.5 py-1.5 text-[12px]"
            disabled={arrows.length === 0}
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

          {/* Nothing to bake until something has been drawn, and applying an
              empty set would flatten the editor for no change at all. */}
          <Button
            className="h-auto gap-1.5 px-2.5 py-1.5 text-[12px]"
            disabled={arrows.length === 0}
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
        {/* `contain` is what the geometry helpers assume; the two have to agree
            or every arrow lands off by the letterbox. */}
        <img
          alt="The image being annotated"
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

        <svg className="pointer-events-none absolute inset-0 size-full">
          {preview.map((arrow, index) => {
            const shape = displayed(arrow)

            if (!shape) {
              return null
            }

            return (
              <g
                key={generateReactKey('arrow', `${arrow.from.x}_${arrow.from.y}`, index)}
                fill={ARROW_COLOR}
                stroke={ARROW_COLOR}
              >
                <line
                  strokeLinecap="round"
                  strokeWidth={ARROW_STROKE * scale}
                  x1={shape.tail.x}
                  x2={shape.shaftEnd.x}
                  y1={shape.tail.y}
                  y2={shape.shaftEnd.y}
                />
                <polygon
                  points={`${shape.tip.x},${shape.tip.y} ${shape.left.x},${shape.left.y} ${shape.right.x},${shape.right.y}`}
                  stroke="none"
                />
              </g>
            )
          })}
        </svg>
      </div>
    </div>
  )
}
