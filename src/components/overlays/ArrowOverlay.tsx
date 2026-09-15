import type { PointerEvent as ReactPointerEvent } from 'react'
import { useCallback, useEffect, useState } from 'react'

import { ArrowStyleControls } from '@/components/overlays/ArrowStyleControls'
import { CheckIcon, Undo2Icon, XIcon } from '@/components/shared/Icons'
import { Button } from '@/components/ui/button'
import type { Arrow } from '@/lib/image/arrow'
import {
  ARROW_COLOR,
  ARROW_STROKE,
  arrowColor,
  arrowOutline,
  arrowStroke,
  clampPixel,
  hitTestArrow,
  isUsableArrow,
  translateArrow,
} from '@/lib/image/arrow'
import { clickToPixel, displayedScale, pixelToDisplayed } from '@/lib/image/pixelize'
import { generateReactKey } from '@/lib/utils'

interface ArrowOverlayProps {
  /** The flattened canvas to draw on. */
  image: string
  onApply: (arrows: Arrow[]) => void
  onCancel: () => void
  onDraftChange: (arrows: Arrow[]) => void
}

/**
 * Points at things the way a tutorial wants: drag from somewhere clear to the
 * thing itself, and the head lands where you let go.
 *
 * Like the numbering tool, the arrows stay overlay elements until Done, so the
 * last one can be taken back and the editor is flattened once rather than once
 * per arrow.
 */
export const ArrowOverlay = ({ image, onApply, onCancel, onDraftChange }: ArrowOverlayProps) => {
  const [frame, setFrame] = useState<HTMLDivElement | null>(null)
  const [size, setSize] = useState<{ width: number; height: number } | null>(null)
  const [arrows, setArrows] = useState<Arrow[]>([])
  const [drawing, setDrawing] = useState<Arrow | null>(null)
  const [selected, setSelected] = useState<number | null>(null)
  const [moving, setMoving] = useState<{
    index: number
    origin: { x: number; y: number }
    arrow: Arrow
  } | null>(null)
  const [color, setColor] = useState(ARROW_COLOR)
  const [stroke, setStroke] = useState(ARROW_STROKE)

  const restyle = (nextColor: string, nextStroke: number) => {
    setColor(nextColor)
    setStroke(nextStroke)

    if (selected !== null) {
      setArrows((current) =>
        current.map((arrow, index) =>
          index === selected ? { ...arrow, color: nextColor, stroke: nextStroke } : arrow,
        ),
      )
      return
    }

    setDrawing((current) => (current ? { ...current, color: nextColor, stroke: nextStroke } : null))
  }

  useEffect(() => {
    onDraftChange(arrows)
  }, [arrows, onDraftChange])

  const undoLast = useCallback(() => {
    setSelected((index) => (index === arrows.length - 1 ? null : index))
    setArrows((current) => current.slice(0, -1))
  }, [arrows.length])

  const deleteSelected = useCallback(() => {
    if (selected === null) {
      undoLast()
      return
    }

    setArrows((current) => current.filter((_, index) => index !== selected))
    setSelected(null)
  }, [selected, undoLast])

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

    const hit = hitTestArrow(arrows, tail)

    if (hit !== null) {
      const arrow = arrows[hit]

      if (!arrow) {
        return
      }

      setSelected(hit)
      setColor(arrowColor(arrow))
      setStroke(arrowStroke(arrow))
      event.currentTarget.setPointerCapture(event.pointerId)
      setMoving({ index: hit, origin: tail, arrow })
      return
    }

    setSelected(null)
    setMoving(null)
    // Captured so the drag keeps reporting after the pointer leaves the frame,
    // which is what lets an arrow be aimed at the very edge.
    event.currentTarget.setPointerCapture(event.pointerId)
    setDrawing({ from: tail, to: tail, color, stroke })
  }

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!box || !size) {
      return
    }

    if (moving) {
      const pixel = clampPixel(box, size, pointIn(event))
      const next = translateArrow(
        moving.arrow,
        { x: pixel.x - moving.origin.x, y: pixel.y - moving.origin.y },
        size,
      )

      setArrows((current) =>
        current.map((arrow, index) =>
          index === moving.index ? { ...next, color: arrow.color, stroke: arrow.stroke } : arrow,
        ),
      )
      return
    }

    if (!drawing) {
      return
    }

    setDrawing({ ...drawing, to: clampPixel(box, size, pointIn(event)) })
  }

  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (moving) {
      setMoving(null)
      return
    }

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
        <ArrowStyleControls
          color={color}
          stroke={stroke}
          onColorChange={(next) => {
            restyle(next, stroke)
          }}
          onStrokeChange={(next) => {
            restyle(color, next)
          }}
        />

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
              <g key={generateReactKey('arrow', `${arrow.from.x}_${arrow.from.y}`, index)}>
                {index === selected && (
                  <g fill="none" opacity={0.9} stroke="white">
                    <line
                      strokeLinecap="round"
                      strokeWidth={(arrowStroke(arrow) + 8) * scale}
                      x1={shape.tail.x}
                      x2={shape.shaftEnd.x}
                      y1={shape.tail.y}
                      y2={shape.shaftEnd.y}
                    />
                    <polygon
                      points={`${shape.tip.x},${shape.tip.y} ${shape.left.x},${shape.left.y} ${shape.right.x},${shape.right.y}`}
                      strokeWidth={4 * scale}
                    />
                  </g>
                )}
                <g fill={arrowColor(arrow)} stroke={arrowColor(arrow)}>
                  <line
                    strokeLinecap="round"
                    strokeWidth={arrowStroke(arrow) * scale}
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
              </g>
            )
          })}
        </svg>
      </div>
    </div>
  )
}
