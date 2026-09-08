import { fileNameOf } from '@/lib/image/image'

/**
 * How many paths the menu remembers. Ten is what most editors settle on: long
 * enough to cover a working session, short enough to read at a glance.
 */
export const MAX_RECENT = 10

export const RECENT_STORAGE_KEY = 'pixen.recent-files'

/**
 * Paths rather than a richer record: the list is only ever read back to reopen
 * a file, and anything else would go stale the moment the file moved.
 */
export const parseRecent = (raw: string | null): string[] => {
  if (!raw) {
    return []
  }

  try {
    const parsed: unknown = JSON.parse(raw)

    if (!Array.isArray(parsed)) {
      return []
    }

    return dedupe(parsed.filter((entry): entry is string => typeof entry === 'string')).slice(
      0,
      MAX_RECENT,
    )
  } catch {
    // Hand-edited or written by an older build: an unusable list is the same
    // as no list, and losing it costs the user nothing.
    return []
  }
}

const dedupe = (paths: readonly string[]): string[] => {
  return [...new Set(paths)]
}

/** The list with `path` at the front, however many times it appeared before. */
export const withRecent = (paths: readonly string[], path: string): string[] => {
  return dedupe([path, ...paths]).slice(0, MAX_RECENT)
}

/** Drops a path, for a file that has been moved or deleted since. */
export const withoutRecent = (paths: readonly string[], path: string): string[] => {
  return paths.filter((entry) => entry !== path)
}

/**
 * What the menu shows. The file name alone, unless another entry shares it —
 * two `Screenshot.png` rows are worse than no list at all — in which case the
 * folder holding it comes along.
 */
export const labelForRecent = (path: string, paths: readonly string[]): string => {
  const name = fileNameOf(path)
  const shared = paths.filter((entry) => entry !== path && fileNameOf(entry) === name).length > 0

  if (!shared) {
    return name
  }

  const parent = parentNameOf(path)

  return parent ? `${name} — ${parent}` : name
}

const parentNameOf = (path: string): string => {
  const segments = path.split(/[/\\]/).filter(Boolean)

  return segments.length > 1 ? segments[segments.length - 2] : ''
}

export const readRecent = (): string[] => {
  try {
    return parseRecent(window.localStorage.getItem(RECENT_STORAGE_KEY))
  } catch {
    // Storage can be unavailable outright; the list is a convenience, so a
    // failure here leaves the app working without one.
    return []
  }
}

export const writeRecent = (paths: readonly string[]): void => {
  try {
    window.localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(paths.slice(0, MAX_RECENT)))
  } catch {
    // Full or blocked storage: the in-memory list still serves this session.
  }
}
