import { describe, expect, it } from 'vitest'

import { BADGE_DIAMETER, badgeRect } from './increment'

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
})
