/** One open image. The editor for it stays mounted until the tab is closed. */
export interface ImageTab {
  id: string
  /**
   * The image handed to the editor. Only opening or a baked tool changes it:
   * the editor reloads — and discards its undo history — whenever this moves.
   */
  image: string
  /** Where Save writes. Null until a save has picked a destination. */
  path: string | null
  /** Base name of the opened file, the default the save dialog offers. */
  name: string
  dirty: boolean
}

export type OpenAction = { type: 'create' } | { type: 'replace'; tabId: string }

/**
 * Replace-if-clean: a dirty tab is kept, so the next image becomes a new tab.
 */
export const decideOpenAction = (
  tabs: Pick<ImageTab, 'id' | 'dirty'>[],
  activeId: string | null,
): OpenAction => {
  if (tabs.length === 0 || activeId === null) {
    return { type: 'create' }
  }

  const active = tabs.find((tab) => tab.id === activeId)

  if (!active) {
    return { type: 'create' }
  }

  if (!active.dirty) {
    return { type: 'replace', tabId: active.id }
  }

  return { type: 'create' }
}

export const nextTabAfterClose = <T extends { id: string }>(
  tabs: T[],
  closedId: string,
): T | null => {
  const index = tabs.findIndex((tab) => tab.id === closedId)
  const remaining = tabs.filter((tab) => tab.id !== closedId)

  if (remaining.length === 0) {
    return null
  }

  return remaining[Math.min(index === -1 ? 0 : index, remaining.length - 1)] ?? null
}
