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
