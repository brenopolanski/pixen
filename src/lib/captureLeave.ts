/** Red close or Quit asked for while a screenshot still holds the session. */
export type LeaveRequest = 'hide' | 'quit'

/** What to replay when the shot reaches a safe point. */
export interface PendingLeave {
  pending: LeaveRequest | null
  /** Red close replaced a quit that was only latched for this shot. */
  shotQuitSuperseded: boolean
}

/**
 * Another screenshot is ignored while one is running. Close and Quit are not:
 * they are remembered and run once the shot reaches a safe point.
 * `null` means the request can run now.
 */
export const leaveWhileCaptureIsBusy = (
  captureBusy: boolean,
  requested: LeaveRequest,
): LeaveRequest | null => {
  if (!captureBusy) {
    return null
  }

  return requested
}

/**
 * The later request wins. Red close after Quit marks that shot-scoped quit as
 * replaced, so its `QUITTING` latch can be dropped before the hide runs.
 * A later Quit clears that mark: the quit is pending again.
 */
export const noteLeaveDuringCapture = (
  pending: LeaveRequest | null,
  shotQuitSuperseded: boolean,
  requested: LeaveRequest,
): PendingLeave => {
  if (requested === 'quit') {
    return { pending: 'quit', shotQuitSuperseded: false }
  }

  return {
    pending: 'hide',
    shotQuitSuperseded: shotQuitSuperseded || pending === 'quit',
  }
}
