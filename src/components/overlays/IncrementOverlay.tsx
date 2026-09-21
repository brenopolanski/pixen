import type { PointerEvent as ReactPointerEvent } from 'react'
import { useCallback, useEffect, useState } from 'react'

import { CheckIcon, Undo2Icon, XIcon } from '@/components/shared/Icons'
import { Button } from '@/components/ui/button'
import { useOverlayFrame } from '@/hooks/useOverlayFrame'
import { clampPixel } from '@/lib/image/arrow'
import type { Stamp } from '@/lib/image/increment'
import {
  BADGE_COLOR,
  BADGE_DIAMETER,
  BADGE_DIAMETER_MAX,
  BADGE_DIAMETER_MIN,
  badgeColor,
  badgeRect,
  badgeTextColor,
  FIRST_STEP,
  hitTestStamp,
  renumberStamps,
  stampDiameter,
  translateStamp,
} from '@/lib/image/increment'
import { clickToPixel, displayedScale, pixelToDisplayed } from '@/lib/image/pixelize'
import { generateReactKey } from '@/lib/utils'

import { StyleControls } from './StyleControls'

interface IncrementOverlayProps {
  /** The flattened canvas to stamp on. */
  image: string
  onApply: (stamps: Stamp[]) => void
  onCancel: () => void
  onDraftChange: (stamps: Stamp[]) => void
}

/**
 * Numbers a screenshot the way a step-by-step guide wants it: click, and the
 * next digit lands there.
 *
 * The badges stay overlay elements until Done, so the counter can actually
 * count and the last one can be taken back. Baking each click straight into the
 * image would flatten the editor once per number and never get past 1.
 */
export const IncrementOverlay = ({
  image,
  onApply,
  onCancel,
  onDraftChange,
}: IncrementOverlayProps) => {
  const { box, setFrame } = useOverlayFrame()
  const [size, setSize] = useState<{ width: number; height: number } | null>(null)
  const [stamps, setStamps] = useState<Stamp[]>([])
  const [selected, setSelected] = useState<number | null>(null)
  const [moving, setMoving] = useState<{
    index: number
    origin: { x: number; y: number }
    stamp: Stamp
  } | null>(null)
  const [color, setColor] = useState(BADGE_COLOR)
  const [diameter, setDiameter] = useState(BADGE_DIAMETER)

  const restyle = (nextColor: string, nextDiameter: number) => {
    setColor(nextColor)
    setDiameter(nextDiameter)

    if (selected !== null) {
      setStamps((current) =>
        current.map((stamp, index) =>
          index === selected ? { ...stamp, color: nextColor, diameter: nextDiameter } : stamp,
        ),
      )
    }
  }

  useEffect(() => {
    onDraftChange(stamps)
  }, [onDraftChange, stamps])

  const undoLast = useCallback(() => {
    setSelected((index) => (index === stamps.length - 1 ? null : index))
    setStamps((current) => renumberStamps(current.slice(0, -1)))
  }, [stamps.length])

  const deleteSelected = useCallback(() => {
    if (selected === null) {
      undoLast()
      return
    }

    setStamps((current) => renumberStamps(current.filter((_, index) => index !== selected)))
    setSelected(null)
  }, [selected, undoLast])

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

  // Badges are measured in image pixels, so on screen they shrink with the
  // image the same way the baked ones will.
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

    // A click in the letterbox is ignored rather than closing the tool: the
    // user is mid-sequence and a miss should not cost them the numbers so far.
    const pixel = clickToPixel(box, size, pointIn(event))

    if (!pixel) {
      return
    }

    const hit = hitTestStamp(stamps, pixel, size)

    if (hit !== null) {
      const stamp = stamps[hit]

      if (!stamp) {
        return
      }

      setSelected(hit)
      setColor(badgeColor(stamp))
      setDiameter(stampDiameter(stamp))
      event.currentTarget.setPointerCapture(event.pointerId)
      setMoving({ index: hit, origin: pixel, stamp })
      return
    }

    setSelected(null)
    setMoving(null)
    setStamps((current) => [
      ...current,
      { step: FIRST_STEP + current.length, ...pixel, color, diameter },
    ])
  }

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!moving || !box || !size) {
      return
    }

    const pixel = clampPixel(box, size, pointIn(event))
    const next = translateStamp(
      moving.stamp,
      { x: pixel.x - moving.origin.x, y: pixel.y - moving.origin.y },
      size,
    )

    setStamps((current) =>
      current.map((stamp, index) =>
        index === moving.index
          ? { ...next, color: stamp.color, diameter: stamp.diameter, step: stamp.step }
          : stamp,
      ),
    )
  }

  const handlePointerUp = () => {
    setMoving(null)
  }

  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-background fade-in">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-2.5">
        <StyleControls
          color={color}
          size={diameter}
          sizeLabel="Size"
          sizeMax={BADGE_DIAMETER_MAX}
          sizeMin={BADGE_DIAMETER_MIN}
          sizeStep={4}
          onColorChange={(next) => {
            restyle(next, diameter)
          }}
          onSizeChange={(next) => {
            restyle(color, next)
          }}
        />

        <div className="flex shrink-0 items-center gap-1.5">
          <Button
            className="h-auto gap-1.5 px-2.5 py-1.5 text-[12px]"
            disabled={stamps.length === 0}
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

          {/* Nothing to bake until something has been stamped, and applying an
              empty set would flatten the editor for no change at all. */}
          <Button
            className="h-auto gap-1.5 px-2.5 py-1.5 text-[12px]"
            disabled={stamps.length === 0}
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
          stamps.map((stamp, index) => {
            // The same rect the composite will use, so a badge nudged away from
            // an edge previews exactly where it lands.
            const rect = badgeRect(size, stamp)
            const origin = pixelToDisplayed(box, size, rect)
            const displayedDiameter = rect.width * scale
            const fill = badgeColor(stamp)

            return (
              <span
                key={generateReactKey('stamp', index)}
                className="pointer-events-none absolute flex items-center justify-center rounded-full font-semibold"
                style={{
                  left: origin.x,
                  top: origin.y,
                  width: displayedDiameter,
                  height: displayedDiameter,
                  fontSize: displayedDiameter * 0.58,
                  backgroundColor: fill,
                  color: badgeTextColor(fill),
                  boxShadow: index === selected ? `0 0 0 ${4 * scale}px white` : undefined,
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
