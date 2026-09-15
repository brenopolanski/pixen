import { describe, expect, it } from 'vitest'

import {
  BADGE_DIAMETER,
  badgeRect,
  badgeTextColor,
  hitTestStamp,
  translateStamp,
} from './increment'

describe('badgeRect', () => {
  const image = { width: 400, height: 300 }

  it('centres the badge on the click', () => {
    expect(badgeRect(image, { x: 200, y: 150 })).toEqual({
      x: 200 - BADGE_DIAMETER / 2,
      y: 150 - BADGE_DIAMETER / 2,
      width: BADGE_DIAMETER,
      height: BADGE_DIAMETER,
    })
  })

  it('keeps a badge dropped at the top-left corner whole', () => {
    expect(badgeRect(image, { x: 2, y: 2 })).toEqual({
      x: 0,
      y: 0,
      width: BADGE_DIAMETER,
      height: BADGE_DIAMETER,
    })
  })

  it('keeps a badge dropped at the bottom-right corner whole', () => {
    expect(badgeRect(image, { x: 399, y: 299 })).toEqual({
      x: image.width - BADGE_DIAMETER,
      y: image.height - BADGE_DIAMETER,
      width: BADGE_DIAMETER,
      height: BADGE_DIAMETER,
    })
  })

  it('shrinks to fit an image smaller than a badge', () => {
    expect(badgeRect({ width: 20, height: 30 }, { x: 10, y: 15 })).toEqual({
      x: 0,
      y: 5,
      width: 20,
      height: 20,
    })
  })

  it('grows with a larger diameter', () => {
    expect(badgeRect(image, { x: 200, y: 150, diameter: 72 })).toEqual({
      x: 200 - 36,
      y: 150 - 36,
      width: 72,
      height: 72,
    })
  })
})

describe('hitTestStamp', () => {
  const image = { width: 400, height: 300 }
  const stamp = { step: 1, x: 100, y: 100 }

  it('hits the centre', () => {
    expect(hitTestStamp([stamp], { x: 100, y: 100 }, image)).toBe(0)
  })

  it('misses a point well off the badge', () => {
    expect(hitTestStamp([stamp], { x: 200, y: 200 }, image)).toBeNull()
  })

  it('prefers the later stamp when they overlap', () => {
    const behind = { step: 1, x: 100, y: 100 }
    const onTop = { step: 2, x: 110, y: 100 }

    expect(hitTestStamp([behind, onTop], { x: 110, y: 100 }, image)).toBe(1)
  })
})

describe('translateStamp', () => {
  const image = { width: 400, height: 300 }
  const stamp = { step: 1, x: 100, y: 100, color: '#3b82f6', diameter: 48 }

  it('moves the centre by the given amount', () => {
    expect(translateStamp(stamp, { x: 10, y: 5 }, image)).toEqual({
      step: 1,
      x: 110,
      y: 105,
      color: '#3b82f6',
      diameter: 48,
    })
  })

  it('stops at the edge so the circle stays on the image', () => {
    const shifted = translateStamp(stamp, { x: 1000, y: 0 }, image)
    const radius = BADGE_DIAMETER / 2

    expect(shifted).toEqual({
      step: 1,
      x: image.width - radius,
      y: 100,
      color: '#3b82f6',
      diameter: 48,
    })
  })
})

describe('badgeTextColor', () => {
  it('keeps white digits on the default red', () => {
    expect(badgeTextColor('#e5484d')).toBe('#ffffff')
  })

  it('uses dark digits on white and yellow', () => {
    expect(badgeTextColor('#ffffff')).toBe('#111111')
    expect(badgeTextColor('#f5d90a')).toBe('#111111')
  })
})
