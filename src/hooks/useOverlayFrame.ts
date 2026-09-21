import { useEffect, useState } from 'react'

import type { Box } from '@/lib/image/pixelize'

/**
 * The overlay frame's CSS size, kept in state so marks remap when the window
 * resizes. Reading `clientWidth` during render would stay stale until the next
 * click.
 */
export const useOverlayFrame = () => {
  const [frame, setFrame] = useState<HTMLDivElement | null>(null)
  const [box, setBox] = useState<Box | null>(null)

  useEffect(() => {
    if (!frame) {
      setBox(null)
      return
    }

    const measure = () => {
      const width = frame.clientWidth
      const height = frame.clientHeight

      setBox((current) => {
        if (current?.width === width && current?.height === height) {
          return current
        }

        return { width, height }
      })
    }

    measure()

    const observer = new ResizeObserver(measure)

    observer.observe(frame)

    return () => {
      observer.disconnect()
    }
  }, [frame])

  return { box, setFrame }
}
