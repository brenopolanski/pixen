import { UNTITLED_PROJECT_NAME } from '@/lib/constants'
import type { PixenProject, RecoverySnapshot } from '@/types/project'
import { PROJECT_FORMAT_VERSION } from '@/types/project'

export const INVALID_PROJECT_MESSAGE = 'This file is not a valid Pixen project.'
export const UNSUPPORTED_VERSION_MESSAGE = 'This Pixen project uses an unsupported version.'

export type ProjectParseResult =
  { ok: true; project: PixenProject } | { ok: false; message: string }

const isFilledString = (value: unknown): value is string => {
  return typeof value === 'string' && value.length > 0
}

/** Images are stored inline, so any other form cannot be restored. */
const isDataUrl = (value: unknown): value is string => {
  return isFilledString(value) && value.startsWith('data:')
}

const asRecord = (value: unknown): Record<string, unknown> | null => {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

const parseJson = (contents: string): unknown => {
  try {
    return JSON.parse(contents)
  } catch {
    return null
  }
}

/**
 * Nothing from disk is trusted: an unreadable project is reported rather than
 * loaded half-way, and a newer format version is refused so the file is never
 * overwritten with a downgraded copy.
 */
export const parseProjectRecord = (value: unknown, now = new Date()): ProjectParseResult => {
  const record = asRecord(value)

  if (!record) {
    return { ok: false, message: INVALID_PROJECT_MESSAGE }
  }

  if (typeof record.version !== 'number' || !Number.isInteger(record.version)) {
    return { ok: false, message: INVALID_PROJECT_MESSAGE }
  }

  if (record.version !== PROJECT_FORMAT_VERSION) {
    return { ok: false, message: UNSUPPORTED_VERSION_MESSAGE }
  }

  if (!isDataUrl(record.image) || !isDataUrl(record.source)) {
    return { ok: false, message: INVALID_PROJECT_MESSAGE }
  }

  const timestamp = now.toISOString()

  return {
    ok: true,
    project: {
      version: PROJECT_FORMAT_VERSION,
      name: isFilledString(record.name) ? record.name : UNTITLED_PROJECT_NAME,
      source: record.source,
      image: record.image,
      createdAt: isFilledString(record.createdAt) ? record.createdAt : timestamp,
      updatedAt: isFilledString(record.updatedAt) ? record.updatedAt : timestamp,
    },
  }
}

export const parseProject = (contents: string, now = new Date()): ProjectParseResult => {
  return parseProjectRecord(parseJson(contents), now)
}

/**
 * Recovery snapshots are Pixen's own bookkeeping, so an unusable one is
 * discarded instead of being reported to the user.
 */
export const parseRecovery = (contents: string, now = new Date()): RecoverySnapshot | null => {
  const record = asRecord(parseJson(contents))

  if (!record) {
    return null
  }

  const result = parseProjectRecord(record.project, now)

  if (!result.ok) {
    return null
  }

  return {
    path: isFilledString(record.path) ? record.path : null,
    project: result.project,
    savedAt: isFilledString(record.savedAt) ? record.savedAt : now.toISOString(),
  }
}
