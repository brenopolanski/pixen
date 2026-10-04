import { describe, expect, it, vi } from 'vitest'

import { presentCapturedScreenshot } from './captureReveal'

const shot = 'data:image/png;base64,shot'
const noLeave = (): boolean => false

describe('presentCapturedScreenshot', () => {
  it('does not place or reveal when the shot produced no image', async () => {
    const placeImage = vi.fn(async () => true)
    const revealFullscreenCapture = vi.fn(async () => {})

    await presentCapturedScreenshot(null, placeImage, revealFullscreenCapture, noLeave)

    expect(placeImage).not.toHaveBeenCalled()
    expect(revealFullscreenCapture).not.toHaveBeenCalled()
  })

  it('does not reveal when placeImage returns false', async () => {
    const placeImage = vi.fn(async () => false)
    const revealFullscreenCapture = vi.fn(async () => {})

    await presentCapturedScreenshot(shot, placeImage, revealFullscreenCapture, noLeave)

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

    await presentCapturedScreenshot(shot, placeImage, revealFullscreenCapture, noLeave)

    expect(order).toEqual(['place', 'reveal'])
    expect(revealFullscreenCapture).toHaveBeenCalledOnce()
  })

  it('does not reveal when red close arrives while placeImage is still running', async () => {
    let pending: 'hide' | null = null
    let finishPlace: (placed: boolean) => void = () => {}
    const placeImage = vi.fn(
      () =>
        new Promise<boolean>((resolve) => {
          finishPlace = resolve
        }),
    )
    const revealFullscreenCapture = vi.fn(async () => {})

    const presented = presentCapturedScreenshot(
      shot,
      placeImage,
      revealFullscreenCapture,
      () => pending !== null,
    )

    pending = 'hide'
    finishPlace(true)
    await presented

    expect(revealFullscreenCapture).not.toHaveBeenCalled()
    expect(pending).toBe('hide')
  })

  it('does not reveal when quit arrives while placeImage is still running', async () => {
    let pending: 'quit' | null = null
    let finishPlace: (placed: boolean) => void = () => {}
    const placeImage = vi.fn(
      () =>
        new Promise<boolean>((resolve) => {
          finishPlace = resolve
        }),
    )
    const revealFullscreenCapture = vi.fn(async () => {})

    const presented = presentCapturedScreenshot(
      shot,
      placeImage,
      revealFullscreenCapture,
      () => pending !== null,
    )

    pending = 'quit'
    finishPlace(true)
    await presented

    expect(revealFullscreenCapture).not.toHaveBeenCalled()
    expect(pending).toBe('quit')
  })
})
