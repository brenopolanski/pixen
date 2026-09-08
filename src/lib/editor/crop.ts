/**
 * Unlayer's crop UI is Cropper.js, mounted in Pixen's own document. There is
 * no apply-crop API, but leaving the tool commits the box — the panel close
 * button is the same path as switching tools. These test ids and classes come
 * from the CDN engine (2.4.0); they need a look after an editor release.
 */
export const CROP_PANEL_TEST_ID = 'native-crop-panel'
export const CROP_CLOSE_TEST_ID = 'native-tool-options-close'
export const CROP_BOX_SELECTOR = '.cropper-crop-box'
export const CROP_HANDLE_SELECTOR = '.cropper-point, .cropper-line'

export interface CropDoubleClickTarget {
  /** Inside the selected rectangle, including the grid overlay. */
  insideCropBox: boolean
  /** On a resize handle — those should keep dragging, not commit. */
  onHandle: boolean
}

export const inspectCropDoubleClick = (target: EventTarget | null): CropDoubleClickTarget => {
  const element = target instanceof Element ? target : null

  if (!element) {
    return { insideCropBox: false, onHandle: false }
  }

  return {
    insideCropBox: element.closest(CROP_BOX_SELECTOR) !== null,
    onHandle: element.closest(CROP_HANDLE_SELECTOR) !== null,
  }
}

export const isCropPanelOpen = (root: ParentNode): boolean => {
  return root.querySelector(`[data-testid="${CROP_PANEL_TEST_ID}"]`) !== null
}

export const shouldApplyCropOnDoubleClick = (
  target: CropDoubleClickTarget,
  cropPanelOpen: boolean,
): boolean => {
  return cropPanelOpen && target.insideCropBox && !target.onHandle
}

/** Clicks Unlayer's Crop close control. Returns false if the button is gone. */
export const closeCropPanel = (root: ParentNode): boolean => {
  const close = root.querySelector<HTMLElement>(`[data-testid="${CROP_CLOSE_TEST_ID}"]`)

  if (!close) {
    return false
  }

  close.click()
  return true
}

export const applyCropFromDoubleClick = (root: ParentNode, target: EventTarget | null): boolean => {
  if (!shouldApplyCropOnDoubleClick(inspectCropDoubleClick(target), isCropPanelOpen(root))) {
    return false
  }

  return closeCropPanel(root)
}
