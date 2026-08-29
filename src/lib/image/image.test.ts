import { describe, expect, it } from 'vitest'

import {
  baseNameOf,
  defaultFileName,
  fileNameOf,
  firstSupportedImagePath,
  formatById,
  formatForPath,
  isSupportedImagePath,
  matchesFormat,
  windowTitle,
  withImageExtension,
} from './image'

const PNG = formatById('png')
const JPEG = formatById('jpeg')
const WEBP = formatById('webp')

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

describe('isSupportedImagePath', () => {
  it('accepts every extension Pixen opens, whatever its case', () => {
    expect(isSupportedImagePath('/tmp/photo.png')).toBe(true)
    expect(isSupportedImagePath('/tmp/photo.JPG')).toBe(true)
    expect(isSupportedImagePath('C:\\Users\\dev\\photo.webp')).toBe(true)
  })

  it('rejects other files and paths with no extension at all', () => {
    expect(isSupportedImagePath('/tmp/notes.pdf')).toBe(false)
    expect(isSupportedImagePath('/tmp/photo.gif')).toBe(false)
    expect(isSupportedImagePath('/tmp/Pictures')).toBe(false)
  })
})

describe('firstSupportedImagePath', () => {
  it('skips past files it cannot open', () => {
    expect(firstSupportedImagePath(['/tmp/notes.pdf', '/tmp/photo.webp'])).toBe('/tmp/photo.webp')
  })

  it('keeps the drop order when several are images', () => {
    expect(firstSupportedImagePath(['/tmp/a.png', '/tmp/b.jpg'])).toBe('/tmp/a.png')
  })

  it('is null for an empty drop and for one with no images', () => {
    expect(firstSupportedImagePath([])).toBeNull()
    expect(firstSupportedImagePath(['/tmp/notes.pdf'])).toBeNull()
  })
})

describe('formatById', () => {
  it('resolves every format the toolbar can offer', () => {
    expect(formatById('jpeg').name).toBe('JPEG')
    expect(formatById('webp').name).toBe('WebP')
  })

  it('falls back to PNG for an id it does not know', () => {
    expect(formatById('gif').name).toBe('PNG')
  })
})

describe('matchesFormat', () => {
  it('accepts every extension the format covers, whatever its case', () => {
    expect(matchesFormat('/tmp/photo.jpg', JPEG)).toBe(true)
    expect(matchesFormat('/tmp/photo.JPEG', JPEG)).toBe(true)
  })

  it('rejects another format and a missing extension', () => {
    expect(matchesFormat('/tmp/photo.png', JPEG)).toBe(false)
    expect(matchesFormat('/tmp/photo', JPEG)).toBe(false)
  })
})

describe('formatForPath', () => {
  it('lets an extension typed into the dialog outrank the chosen format', () => {
    expect(formatForPath('/tmp/photo.png', JPEG).id).toBe('png')
    expect(formatForPath('/tmp/photo.JPG', PNG).id).toBe('jpeg')
    expect(formatForPath('/tmp/photo.webp', PNG).id).toBe('webp')
  })

  it('keeps the chosen format when the path says nothing it can encode', () => {
    expect(formatForPath('/tmp/photo.gif', WEBP).id).toBe('webp')
    expect(formatForPath('/tmp/photo', JPEG).id).toBe('jpeg')
  })
})

describe('defaultFileName', () => {
  it('names the file for the chosen format', () => {
    expect(defaultFileName('my-image', PNG)).toBe('my-image.png')
    expect(defaultFileName('my-image', JPEG)).toBe('my-image.jpg')
    expect(defaultFileName('my-image', WEBP)).toBe('my-image.webp')
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
