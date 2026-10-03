import type { OverlayDecision } from '@/lib/desktop'
import type { Arrow } from '@/lib/image/arrow'
import type { Stamp } from '@/lib/image/increment'
import type { Rect } from '@/lib/image/pixelize'

/** In-progress marks on the open overlay, or none. */
export type OverlayDraft =
  | { type: 'arrow'; arrows: Arrow[] }
  | { type: 'increment'; stamps: Stamp[] }
  | { type: 'pixelize'; regions: Rect[] }
  | { type: 'cutout'; image: string | null }
  | { type: 'none' }

/** An overlay that is actually open, as opposed to `none`. */
export type OverlayKind = Exclude<OverlayDraft['type'], 'none'>

/**
 * What a Save or Save As should do once any pending tool marks are known.
 * `write` is the path with nothing waiting. Apply and Don't Apply both still
 * write; Cancel does not.
 */
export type SaveStep = 'write' | 'apply-then-write' | 'discard-then-write' | 'abort'

export const planSave = (needsPrompt: boolean, decision: OverlayDecision | null): SaveStep => {
  if (!needsPrompt) {
    return 'write'
  }

  if (decision === 'apply') {
    return 'apply-then-write'
  }

  if (decision === 'discard') {
    return 'discard-then-write'
  }

  return 'abort'
}

/** A Save or Save As that is already asking, or already writing, ignores another click. */
export const ignoresRepeatedSave = (saveInFlight: boolean): boolean => {
  return saveInFlight
}

/**
 * Don't Apply writes first. The overlay is removed only when that write
 * returns true, which is after the file exists. A cancelled panel returns
 * false, and a failed write throws; both leave the marks where they were.
 */
export const commitDiscardedOverlay = async (
  write: () => Promise<boolean>,
  clear: () => void,
): Promise<boolean> => {
  const wrote = await write()

  if (wrote) {
    clear()
  }

  return wrote
}

/**
 * Quit and the red close button settle an open tool before they look for
 * unsaved document changes, the same order Save uses. Applying the marks
 * makes the document dirty, so the unsaved prompt then sees them; discarding
 * them leaves the document as it was. False means stay: either prompt was
 * cancelled.
 */
export const settleBeforeLeaving = async (
  overlayOpen: boolean,
  settleOverlay: () => Promise<string | false>,
  settleDocument: () => Promise<boolean>,
): Promise<boolean> => {
  if (overlayOpen && (await settleOverlay()) === false) {
    return false
  }

  return settleDocument()
}

/** True when leaving would drop marks that have not been baked yet. */
export const overlayNeedsPrompt = (draft: OverlayDraft): boolean => {
  switch (draft.type) {
    case 'arrow':
      return draft.arrows.length > 0
    case 'increment':
      return draft.stamps.length > 0
    case 'pixelize':
      return draft.regions.length > 0
    case 'cutout':
      return draft.image !== null
    case 'none':
      return false
  }
}
