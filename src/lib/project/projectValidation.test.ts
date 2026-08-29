import { describe, expect, it } from 'vitest'

import { PROJECT_FORMAT_VERSION } from '@/types/project'

import {
  INVALID_PROJECT_MESSAGE,
  parseProject,
  parseRecovery,
  UNSUPPORTED_VERSION_MESSAGE,
} from './projectValidation'

const IMAGE = 'data:image/png;base64,AAAA'
const NOW = new Date('2026-01-02T03:04:05.000Z')

const project = (overrides: Record<string, unknown> = {}) => ({
  version: PROJECT_FORMAT_VERSION,
  name: 'my-image',
  source: IMAGE,
  image: IMAGE,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
})

describe('parseProject', () => {
  it('accepts a well-formed project', () => {
    const result = parseProject(JSON.stringify(project()))

    expect(result).toEqual({ ok: true, project: project() })
  })

  it('rejects malformed JSON', () => {
    expect(parseProject('{ not json')).toEqual({ ok: false, message: INVALID_PROJECT_MESSAGE })
  })

  it('rejects a JSON value that is not an object', () => {
    expect(parseProject('[]')).toEqual({ ok: false, message: INVALID_PROJECT_MESSAGE })
    expect(parseProject('"pix"')).toEqual({ ok: false, message: INVALID_PROJECT_MESSAGE })
  })

  it('reports an unsupported version instead of guessing', () => {
    expect(parseProject(JSON.stringify(project({ version: PROJECT_FORMAT_VERSION + 1 })))).toEqual({
      ok: false,
      message: UNSUPPORTED_VERSION_MESSAGE,
    })
  })

  it('rejects a missing or non-numeric version', () => {
    expect(parseProject(JSON.stringify(project({ version: '1' })))).toEqual({
      ok: false,
      message: INVALID_PROJECT_MESSAGE,
    })
  })

  it('rejects images that are not data URLs', () => {
    expect(parseProject(JSON.stringify(project({ image: 'https://example.com/a.png' })))).toEqual({
      ok: false,
      message: INVALID_PROJECT_MESSAGE,
    })
    expect(parseProject(JSON.stringify(project({ source: '' })))).toEqual({
      ok: false,
      message: INVALID_PROJECT_MESSAGE,
    })
  })

  it('fills in a missing name and timestamps rather than failing', () => {
    const result = parseProject(
      JSON.stringify({ version: PROJECT_FORMAT_VERSION, source: IMAGE, image: IMAGE }),
      NOW,
    )

    expect(result).toEqual({
      ok: true,
      project: {
        version: PROJECT_FORMAT_VERSION,
        name: 'Untitled',
        source: IMAGE,
        image: IMAGE,
        createdAt: NOW.toISOString(),
        updatedAt: NOW.toISOString(),
      },
    })
  })
})

describe('parseRecovery', () => {
  it('reads a snapshot with its path', () => {
    const snapshot = { path: '/tmp/my-image.pix', project: project(), savedAt: NOW.toISOString() }

    expect(parseRecovery(JSON.stringify(snapshot))).toEqual(snapshot)
  })

  it('treats a never-saved snapshot as having no path', () => {
    const result = parseRecovery(JSON.stringify({ project: project() }), NOW)

    expect(result).toEqual({ path: null, project: project(), savedAt: NOW.toISOString() })
  })

  it('discards a snapshot it cannot use', () => {
    expect(parseRecovery('{ not json')).toBeNull()
    expect(parseRecovery(JSON.stringify({ project: { version: 99 } }))).toBeNull()
    expect(parseRecovery(JSON.stringify({ savedAt: NOW.toISOString() }))).toBeNull()
  })
})
