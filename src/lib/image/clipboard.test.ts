import { describe, expect, it } from 'vitest'

import type { ClipboardContents } from './clipboard'
import {
  hasUnsupportedImage,
  isSupportedImageType,
  isTextEntryTarget,
  pastedImage,
} from './clipboard'

const target = (tagName: string, isContentEditable = false) => ({ tagName, isContentEditable })

const file = (type: string, name = ''): File => ({ type, name }) as File

/** `items` is what a screenshot paste populates; `files` is what a copied file uses. */
const clipboard = (files: File[], items: Partial<DataTransferItem>[] = []): ClipboardContents => ({
  files,
  items: items as DataTransferItem[],
})

describe('isSupportedImageType', () => {
  it('covers exactly the formats Pixen can open', () => {
    expect(isSupportedImageType('image/png')).toBe(true)
    expect(isSupportedImageType('image/jpeg')).toBe(true)
    expect(isSupportedImageType('image/webp')).toBe(true)
    expect(isSupportedImageType('image/gif')).toBe(false)
    expect(isSupportedImageType('text/plain')).toBe(false)
  })
})

describe('isTextEntryTarget', () => {
  it('leaves paste alone in the fields that need it', () => {
    expect(isTextEntryTarget(target('INPUT'))).toBe(true)
    expect(isTextEntryTarget(target('TEXTAREA'))).toBe(true)
    expect(isTextEntryTarget(target('SELECT'))).toBe(true)
  })

  it('leaves paste alone in the editor text tool, which is contenteditable', () => {
    expect(isTextEntryTarget(target('DIV', true))).toBe(true)
  })

  it('claims paste for everything else', () => {
    expect(isTextEntryTarget(target('DIV'))).toBe(false)
    expect(isTextEntryTarget(target('CANVAS'))).toBe(false)
    expect(isTextEntryTarget(null)).toBe(false)
  })
})

describe('pastedImage', () => {
  it('finds an image among files', () => {
    expect(pastedImage(clipboard([file('image/png', 'shot.png')]))?.name).toBe('shot.png')
  })

  it('falls back to items, which is where a screenshot lands', () => {
    const screenshot = file('image/png')

    expect(
      pastedImage(
        clipboard([], [{ kind: 'file', type: 'image/png', getAsFile: () => screenshot }]),
      ),
    ).toBe(screenshot)
  })

  it('ignores types it cannot open, and an empty clipboard', () => {
    expect(pastedImage(clipboard([file('image/gif')]))).toBeNull()
    expect(pastedImage(clipboard([]))).toBeNull()
    expect(pastedImage(null)).toBeNull()
  })
})

describe('hasUnsupportedImage', () => {
  it('spots an image Pixen cannot open, so the paste can be explained', () => {
    expect(hasUnsupportedImage(clipboard([], [{ kind: 'file', type: 'image/gif' }]))).toBe(true)
  })

  it('stays quiet for supported images and for non-images', () => {
    expect(hasUnsupportedImage(clipboard([], [{ kind: 'file', type: 'image/png' }]))).toBe(false)
    expect(hasUnsupportedImage(clipboard([], [{ kind: 'string', type: 'text/plain' }]))).toBe(false)
    expect(hasUnsupportedImage(null)).toBe(false)
  })
})
