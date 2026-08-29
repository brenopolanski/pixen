import { describe, expect, it } from 'vitest'

import { baseNameOf, fileNameOf, formatForPath, windowTitle, withImageExtension } from './image'

const PNG = formatForPath('a.png')
const JPEG = formatForPath('a.jpg')

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
    expect(baseNameOf('/tmp/my-image.png')).toBe('my-image')
  })

  it('keeps dots inside the name', () => {
    expect(baseNameOf('/tmp/logo.dark.png')).toBe('logo.dark')
  })

  it('keeps a leading dot, which is not an extension', () => {
    expect(baseNameOf('/tmp/.hidden')).toBe('.hidden')
  })
})

describe('formatForPath', () => {
  it('reads the format from the extension, whatever its case', () => {
    expect(formatForPath('/tmp/photo.png').mimeType).toBe('image/png')
    expect(formatForPath('/tmp/photo.JPG').mimeType).toBe('image/jpeg')
    expect(formatForPath('/tmp/photo.jpeg').mimeType).toBe('image/jpeg')
    expect(formatForPath('/tmp/photo.webp').mimeType).toBe('image/webp')
  })

  it('falls back to PNG rather than trusting an extension it cannot encode', () => {
    expect(formatForPath('/tmp/photo.gif').mimeType).toBe('image/png')
    expect(formatForPath('/tmp/photo').mimeType).toBe('image/png')
  })
})

describe('withImageExtension', () => {
  it('adds a missing extension', () => {
    expect(withImageExtension('/tmp/my-image', PNG)).toBe('/tmp/my-image.png')
    expect(withImageExtension('/tmp/my-image', JPEG)).toBe('/tmp/my-image.jpg')
  })

  it('accepts any extension the format already covers', () => {
    expect(withImageExtension('/tmp/my-image.jpg', JPEG)).toBe('/tmp/my-image.jpg')
    expect(withImageExtension('/tmp/my-image.jpeg', JPEG)).toBe('/tmp/my-image.jpeg')
    expect(withImageExtension('/tmp/my-image.PNG', PNG)).toBe('/tmp/my-image.PNG')
  })

  it('appends when the extension belongs to another format', () => {
    expect(withImageExtension('/tmp/my-image.png', JPEG)).toBe('/tmp/my-image.png.jpg')
  })
})

describe('windowTitle', () => {
  it('is just the app name when nothing is open', () => {
    expect(windowTitle({ path: null, hasImage: false, dirty: false })).toBe('Pixen')
  })

  it('calls an image with no destination yet Untitled', () => {
    expect(windowTitle({ path: null, hasImage: true, dirty: false })).toBe('Pixen — Untitled')
  })

  it('shows the file name once a save has picked one', () => {
    expect(windowTitle({ path: '/tmp/my-image.png', hasImage: true, dirty: false })).toBe(
      'Pixen — my-image.png',
    )
  })

  it('marks unsaved changes', () => {
    expect(windowTitle({ path: '/tmp/my-image.png', hasImage: true, dirty: true })).toBe(
      'Pixen — my-image.png *',
    )
    expect(windowTitle({ path: null, hasImage: true, dirty: true })).toBe('Pixen — Untitled *')
  })
})
