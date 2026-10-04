/**
 * Insert a produced shot, then switch to the Workspace where Pixen is open.
 * Escape, a failed shot, a cancelled insert, and a red close or Quit that
 * arrived during the insert never reveal.
 */
export const presentCapturedScreenshot = async (
  dataUrl: string | null,
  placeImage: (dataUrl: string) => Promise<boolean>,
  revealFullscreenCapture: () => Promise<void>,
  leavePending: () => boolean,
): Promise<void> => {
  if (!dataUrl) {
    return
  }

  const placed = await placeImage(dataUrl)

  if (!placed) {
    return
  }

  // Read after the insert. A close or Quit during placeImage is already
  // stored, and run() replays it after this function returns.
  if (leavePending()) {
    return
  }

  await revealFullscreenCapture()
}
