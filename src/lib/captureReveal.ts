/**
 * Insert a produced shot, then switch to an existing fullscreen Space.
 * Escape, a failed shot, and a cancelled insert never reveal.
 */
export const presentCapturedScreenshot = async (
  dataUrl: string | null,
  placeImage: (dataUrl: string) => Promise<boolean>,
  revealFullscreenCapture: () => Promise<void>,
): Promise<void> => {
  if (!dataUrl) {
    return
  }

  const placed = await placeImage(dataUrl)

  if (!placed) {
    return
  }

  await revealFullscreenCapture()
}
