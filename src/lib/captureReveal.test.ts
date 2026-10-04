import { describe, expect, it, vi } from 'vitest'

import { presentCapturedScreenshot } from './captureReveal'

const shot = 'data:image/png;base64,shot'

describe('presentCapturedScreenshot', () => {
  it('does not place or reveal when the shot produced no image', async () => {
    const placeImage = vi.fn(async () => true)
    const revealFullscreenCapture = vi.fn(async () => {})

    await presentCapturedScreenshot(null, placeImage, revealFullscreenCapture)

    expect(placeImage).not.toHaveBeenCalled()
    expect(revealFullscreenCapture).not.toHaveBeenCalled()
  })

  it('does not reveal when placeImage returns false', async () => {
    const placeImage = vi.fn(async () => false)
    const revealFullscreenCapture = vi.fn(async () => {})

    await presentCapturedScreenshot(shot, placeImage, revealFullscreenCapture)

    expect(placeImage).toHaveBeenCalledWith(shot)
    expect(revealFullscreenCapture).not.toHaveBeenCalled()
  })

  it('reveals exactly once, after placeImage returns true', async () => {
    const order: string[] = []
    const placeImage = vi.fn(async () => {
      order.push('place')
      return true
    })
    const revealFullscreenCapture = vi.fn(async () => {
      order.push('reveal')
    })

    await presentCapturedScreenshot(shot, placeImage, revealFullscreenCapture)

    expect(order).toEqual(['place', 'reveal'])
    expect(revealFullscreenCapture).toHaveBeenCalledOnce()
  })

  it('does not reveal when a shot on another Workspace is cancelled', async () => {
    const placeImage = vi.fn(async () => true)
    const revealFullscreenCapture = vi.fn(async () => {})

    await presentCapturedScreenshot(null, placeImage, revealFullscreenCapture)

    expect(revealFullscreenCapture).not.toHaveBeenCalled()
  })

  it('reveals after a shot on another Workspace is inserted', async () => {
    const order: string[] = []
    const placeImage = vi.fn(async () => {
      order.push('place')
      return true
    })
    const revealFullscreenCapture = vi.fn(async () => {
      order.push('reveal')
    })

    await presentCapturedScreenshot(shot, placeImage, revealFullscreenCapture)

    expect(order).toEqual(['place', 'reveal'])
  })
})
