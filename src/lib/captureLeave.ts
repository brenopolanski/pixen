/** Red close or Quit asked for while a screenshot still holds the session. */
export type LeaveRequest = 'hide' | 'quit'

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
