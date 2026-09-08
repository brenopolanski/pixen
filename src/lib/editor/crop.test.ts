import { describe, expect, it } from 'vitest'

import { shouldApplyCropOnDoubleClick } from './crop'

const inside = { insideCropBox: true, onHandle: false }
const handle = { insideCropBox: true, onHandle: true }
const outside = { insideCropBox: false, onHandle: false }

describe('shouldApplyCropOnDoubleClick', () => {
  it('applies a double-click inside the crop box while Crop is open', () => {
    expect(shouldApplyCropOnDoubleClick(inside, true)).toBe(true)
  })

  it('ignores a double-click on a resize handle', () => {
    expect(shouldApplyCropOnDoubleClick(handle, true)).toBe(false)
  })

  it('ignores a double-click outside the crop box', () => {
    expect(shouldApplyCropOnDoubleClick(outside, true)).toBe(false)
  })

  it('ignores a double-click when Crop is not the open tool', () => {
    expect(shouldApplyCropOnDoubleClick(inside, false)).toBe(false)
  })
})
