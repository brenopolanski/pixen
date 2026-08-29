import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { PixenError } from '@/lib/errors'

import { blobToDataUrl, removeImageBackground } from './cutout'

const removeBackground = vi.hoisted(() => vi.fn())

// The real library pulls in onnxruntime and a 44 MB model, neither of which
// belongs in a unit test. Only the wrapper around it is under test here.
vi.mock('@imgly/background-removal', () => ({ removeBackground }))

/**
 * The node test environment has no FileReader, so each test installs one that
 * ends in whatever state it wants to check.
 */
const stubFileReader = (outcome: { result?: unknown; fail?: boolean }) => {
  class FakeFileReader {
    result: unknown = outcome.result
    onload: (() => void) | null = null
    onerror: (() => void) | null = null

    readAsDataURL() {
      queueMicrotask(() => {
        if (outcome.fail) {
          this.onerror?.()
          return
        }

        this.onload?.()
      })
    }
  }

  vi.stubGlobal('FileReader', FakeFileReader)
}

afterEach(() => {
  vi.unstubAllGlobals()
  removeBackground.mockReset()
})

describe('blobToDataUrl', () => {
  it('resolves with what the reader read', async () => {
    stubFileReader({ result: 'data:image/png;base64,AAAA' })

    await expect(blobToDataUrl(new Blob())).resolves.toBe('data:image/png;base64,AAAA')
  })

  it('rejects with a showable message when the read fails', async () => {
    stubFileReader({ fail: true })

    await expect(blobToDataUrl(new Blob())).rejects.toThrow(PixenError)
  })

  it('rejects rather than resolving with a buffer when the read is not text', async () => {
    stubFileReader({ result: new ArrayBuffer(4) })

    await expect(blobToDataUrl(new Blob())).rejects.toThrow(PixenError)
  })
})

describe('removeImageBackground', () => {
  // Stands in for the document the assets are resolved against; a release build
  // serves the app over `tauri://`, which is the case worth exercising.
  beforeEach(() => {
    vi.stubGlobal('window', { location: { href: 'tauri://localhost/index.html' } })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({}) }))
  })

  it('asks the model for a PNG from the local assets', async () => {
    stubFileReader({ result: 'data:image/png;base64,AAAA' })
    removeBackground.mockResolvedValue(new Blob())

    await removeImageBackground('data:image/png;base64,BBBB', vi.fn())

    expect(removeBackground).toHaveBeenCalledWith(
      'data:image/png;base64,BBBB',
      expect.objectContaining({
        // Absolute, because the library uses it as a base for `new URL`.
        publicPath: 'tauri://localhost/bg-removal/',
        model: 'isnet_quint8',
        output: { format: 'image/png' },
      }),
    )
  })

  it('reports one rising fraction across every chunk the model loads', async () => {
    stubFileReader({ result: 'data:image/png;base64,AAAA' })

    const seen: number[] = []

    removeBackground.mockImplementation(
      async (
        _image: string,
        config: { progress: (key: string, done: number, size: number) => void },
      ) => {
        config.progress('fetch:chunk-a', 50, 100)
        config.progress('fetch:chunk-b', 0, 100)
        config.progress('fetch:chunk-a', 100, 100)
        config.progress('fetch:chunk-b', 100, 100)

        return new Blob()
      },
    )

    await removeImageBackground('data:image/png;base64,BBBB', (ratio) => seen.push(ratio))

    // Per-resource ratios would have dropped from 0.5 to 0 on the second chunk.
    expect(seen).toEqual([0.5, 0.25, 0.5, 1])
  })

  it('explains how to fetch the assets when the manifest is missing', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }))

    await expect(removeImageBackground('data:image/png;base64,BBBB', vi.fn())).rejects.toThrow(
      /assets:bg-removal/,
    )
    expect(removeBackground).not.toHaveBeenCalled()
  })

  it('says the same when a dev server answers with its index.html', async () => {
    // Vite serves the app shell for unknown paths, so a missing model comes
    // back as HTML with a 200 rather than as a 404.
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.reject(new SyntaxError('Unexpected token <')),
      }),
    )

    await expect(removeImageBackground('data:image/png;base64,BBBB', vi.fn())).rejects.toThrow(
      /assets:bg-removal/,
    )
    expect(removeBackground).not.toHaveBeenCalled()
  })

  it('passes a failure from the model through untouched', async () => {
    removeBackground.mockRejectedValue(new Error('WebAssembly.instantiate failed'))

    await expect(removeImageBackground('data:image/png;base64,BBBB', vi.fn())).rejects.toThrow(
      'WebAssembly.instantiate failed',
    )
  })
})
