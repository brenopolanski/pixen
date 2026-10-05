import { describe, expect, it } from 'vitest'

import { leaveWhileCaptureIsBusy, noteLeaveDuringCapture } from './captureLeave'

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

describe('noteLeaveDuringCapture', () => {
  it('keeps quit while the screenshot is still the only leave', () => {
    expect(noteLeaveDuringCapture(null, false, 'quit')).toEqual({
      pending: 'quit',
      shotQuitSuperseded: false,
    })
  })

  it('lets a later red close replace that quit', () => {
    const quit = noteLeaveDuringCapture(null, false, 'quit')
    expect(noteLeaveDuringCapture(quit.pending, quit.shotQuitSuperseded, 'hide')).toEqual({
      pending: 'hide',
      shotQuitSuperseded: true,
    })
  })

  it('remembers a red close that was never a quit', () => {
    expect(noteLeaveDuringCapture(null, false, 'hide')).toEqual({
      pending: 'hide',
      shotQuitSuperseded: false,
    })
  })

  it('lets a later quit become the pending action again', () => {
    const replaced = noteLeaveDuringCapture('quit', false, 'hide')
    expect(noteLeaveDuringCapture(replaced.pending, replaced.shotQuitSuperseded, 'quit')).toEqual({
      pending: 'quit',
      shotQuitSuperseded: false,
    })
  })
})
