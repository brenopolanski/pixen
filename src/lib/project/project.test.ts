import { describe, expect, it } from 'vitest'

import { PROJECT_FORMAT_VERSION } from '@/types/project'

import {
  baseNameOf,
  createProject,
  fileNameOf,
  projectFileName,
  renameProject,
  windowTitle,
  withProjectExtension,
  withSavedImage,
} from './project'

const IMAGE = 'data:image/png;base64,AAAA'
const NOW = new Date('2026-01-02T03:04:05.000Z')

describe('fileNameOf', () => {
  it('reads POSIX and Windows paths', () => {
    expect(fileNameOf('/Users/dev/pictures/photo.png')).toBe('photo.png')
    expect(fileNameOf('C:\\Users\\dev\\pictures\\photo.png')).toBe('photo.png')
  })

  it('passes through a bare file name', () => {
    expect(fileNameOf('photo.png')).toBe('photo.png')
  })
})

describe('baseNameOf', () => {
  it('drops the extension', () => {
    expect(baseNameOf('/tmp/my-image.pix')).toBe('my-image')
  })

  it('keeps dots inside the name', () => {
    expect(baseNameOf('/tmp/logo.dark.png')).toBe('logo.dark')
  })

  it('keeps a leading dot, which is not an extension', () => {
    expect(baseNameOf('/tmp/.hidden')).toBe('.hidden')
  })
})

describe('createProject', () => {
  it('stores the opened image as both the source and the current image', () => {
    const project = createProject('photo', IMAGE, NOW)

    expect(project).toEqual({
      version: PROJECT_FORMAT_VERSION,
      name: 'photo',
      source: IMAGE,
      image: IMAGE,
      createdAt: NOW.toISOString(),
      updatedAt: NOW.toISOString(),
    })
  })
})

describe('withSavedImage', () => {
  it('replaces the image and touches updatedAt, leaving the source alone', () => {
    const project = createProject('photo', IMAGE, NOW)
    const later = new Date('2026-02-03T04:05:06.000Z')
    const saved = withSavedImage(project, 'data:image/png;base64,BBBB', later)

    expect(saved.image).toBe('data:image/png;base64,BBBB')
    expect(saved.source).toBe(IMAGE)
    expect(saved.createdAt).toBe(NOW.toISOString())
    expect(saved.updatedAt).toBe(later.toISOString())
  })
})

describe('renameProject', () => {
  it('changes only the name', () => {
    const project = createProject('photo', IMAGE, NOW)

    expect(renameProject(project, 'renamed')).toEqual({ ...project, name: 'renamed' })
  })
})

describe('projectFileName', () => {
  it('appends the project extension', () => {
    expect(projectFileName(createProject('my-image', IMAGE, NOW))).toBe('my-image.pix')
  })
})

describe('withProjectExtension', () => {
  it('adds a missing extension', () => {
    expect(withProjectExtension('/tmp/my-image')).toBe('/tmp/my-image.pix')
  })

  it('leaves an existing extension alone, whatever its case', () => {
    expect(withProjectExtension('/tmp/my-image.pix')).toBe('/tmp/my-image.pix')
    expect(withProjectExtension('/tmp/my-image.PIX')).toBe('/tmp/my-image.PIX')
  })
})

describe('windowTitle', () => {
  it('is just the app name when nothing is open', () => {
    expect(windowTitle({ path: null, hasProject: false, dirty: false })).toBe('Pixen')
  })

  it('calls an unsaved project Untitled', () => {
    expect(windowTitle({ path: null, hasProject: true, dirty: false })).toBe('Pixen — Untitled')
  })

  it('shows the file name once the project has a path', () => {
    expect(windowTitle({ path: '/tmp/my-image.pix', hasProject: true, dirty: false })).toBe(
      'Pixen — my-image.pix',
    )
  })

  it('marks unsaved changes', () => {
    expect(windowTitle({ path: '/tmp/my-image.pix', hasProject: true, dirty: true })).toBe(
      'Pixen — my-image.pix *',
    )
    expect(windowTitle({ path: null, hasProject: true, dirty: true })).toBe('Pixen — Untitled *')
  })
})
