import { describe, expect, it } from 'vitest'

import { labelForRecent, MAX_RECENT, parseRecent, withoutRecent, withRecent } from './recent'

describe('parseRecent', () => {
  it('reads a stored list back', () => {
    expect(parseRecent('["/a/one.png","/b/two.jpg"]')).toEqual(['/a/one.png', '/b/two.jpg'])
  })

  it('has nothing to read before anything has been opened', () => {
    expect(parseRecent(null)).toEqual([])
  })

  it('ignores a list that is not one', () => {
    expect(parseRecent('{"paths":[]}')).toEqual([])
    expect(parseRecent('not json')).toEqual([])
  })

  it('drops entries that are not paths', () => {
    expect(parseRecent('["/a/one.png",42,null,"/b/two.png"]')).toEqual(['/a/one.png', '/b/two.png'])
  })

  it('caps a list that grew too long elsewhere', () => {
    const stored = Array.from({ length: MAX_RECENT + 5 }, (_, index) => `/a/${index}.png`)

    expect(parseRecent(JSON.stringify(stored))).toHaveLength(MAX_RECENT)
  })
})

describe('withRecent', () => {
  it('puts the newest path first', () => {
    expect(withRecent(['/a/one.png'], '/b/two.png')).toEqual(['/b/two.png', '/a/one.png'])
  })

  it('moves a path already on the list rather than repeating it', () => {
    expect(withRecent(['/a/one.png', '/b/two.png'], '/b/two.png')).toEqual([
      '/b/two.png',
      '/a/one.png',
    ])
  })

  it('forgets the oldest path once the list is full', () => {
    const full = Array.from({ length: MAX_RECENT }, (_, index) => `/a/${index}.png`)
    const next = withRecent(full, '/a/new.png')

    expect(next).toHaveLength(MAX_RECENT)
    expect(next[0]).toBe('/a/new.png')
    expect(next).not.toContain(`/a/${MAX_RECENT - 1}.png`)
  })
})

describe('withoutRecent', () => {
  it('drops a path that is no longer there', () => {
    expect(withoutRecent(['/a/one.png', '/b/two.png'], '/a/one.png')).toEqual(['/b/two.png'])
  })

  it('leaves a list that never held it alone', () => {
    expect(withoutRecent(['/a/one.png'], '/b/two.png')).toEqual(['/a/one.png'])
  })
})

describe('labelForRecent', () => {
  it('shows the file name on its own', () => {
    expect(labelForRecent('/a/one.png', ['/a/one.png', '/b/two.png'])).toBe('one.png')
  })

  it('names the folder when two entries share a file name', () => {
    const paths = ['/shots/today/Screenshot.png', '/shots/friday/Screenshot.png']

    expect(labelForRecent(paths[0], paths)).toBe('Screenshot.png — today')
    expect(labelForRecent(paths[1], paths)).toBe('Screenshot.png — friday')
  })

  it('reads a Windows path the same way', () => {
    const paths = ['C:\\shots\\today\\Screenshot.png', 'C:\\shots\\friday\\Screenshot.png']

    expect(labelForRecent(paths[0], paths)).toBe('Screenshot.png — today')
  })

  it('has no folder to fall back on for a bare name', () => {
    expect(labelForRecent('one.png', ['one.png', '/b/one.png'])).toBe('one.png')
  })
})
