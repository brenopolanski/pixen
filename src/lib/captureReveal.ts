/**
 * Switch back to an existing fullscreen Space only after the shot is in the
 * editor. A cancelled insert leaves the user on the current Workspace.
 */
export const shouldRevealCapturedImage = (placed: boolean): boolean => {
  return placed
}
