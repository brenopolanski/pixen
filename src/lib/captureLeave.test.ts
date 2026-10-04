import { describe, expect, it } from 'vitest'

import { leaveWhileCaptureIsBusy } from './captureLeave'

describe('leaveWhileCaptureIsBusy', () => {
  it('remembers a red close while a screenshot is running', () => {
    expect(leaveWhileCaptureIsBusy(true, 'hide')).toBe('hide')
  })

  it('remembers quit while a screenshot is running', () => {
    expect(leaveWhileCaptureIsBusy(true, 'quit')).toBe('quit')
  })

  it('runs close and quit immediately when no screenshot is in progress', () => {
    expect(leaveWhileCaptureIsBusy(false, 'hide')).toBeNull()
    expect(leaveWhileCaptureIsBusy(false, 'quit')).toBeNull()
  })
})
