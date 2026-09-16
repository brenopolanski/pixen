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

  it('holds the next run until the one in flight is done', async () => {
    stubFileReader({ result: 'data:image/png;base64,AAAA' })

    const entered: string[] = []
    let releaseFirst: (() => void) | undefined

    // One ONNX session serves the whole process and will not take two runs at
    // once. The first is left hanging on purpose: cancelling an overlay cannot
    // abort inference, so this is what a reopen has to queue behind.
    removeBackground.mockImplementation((image: string) => {
      entered.push(image)

      if (entered.length > 1) {
        return Promise.resolve(new Blob())
      }

      return new Promise<Blob>((resolve) => {
        releaseFirst = () => resolve(new Blob())
      })
    })

    const first = removeImageBackground('data:image/png;base64,ONE', vi.fn())
    const second = removeImageBackground('data:image/png;base64,TWO', vi.fn())

    await vi.waitFor(() => {
      expect(releaseFirst).toBeDefined()
    })

    expect(entered).toEqual(['data:image/png;base64,ONE'])

    releaseFirst?.()

    await expect(first).resolves.toBe('data:image/png;base64,AAAA')
    await expect(second).resolves.toBe('data:image/png;base64,AAAA')
    // Each run got its own image rather than the other's.
    expect(entered).toEqual(['data:image/png;base64,ONE', 'data:image/png;base64,TWO'])
  })

  it('drops a run that was cancelled while it waited its turn', async () => {
    stubFileReader({ result: 'data:image/png;base64,AAAA' })

    const entered: string[] = []
    let releaseFirst: (() => void) | undefined

    removeBackground.mockImplementation((image: string) => {
      entered.push(image)

      if (entered.length > 1) {
        return Promise.resolve(new Blob())
      }

      return new Promise<Blob>((resolve) => {
        releaseFirst = () => resolve(new Blob())
      })
    })

    const controller = new AbortController()
    const first = removeImageBackground('data:image/png;base64,ONE', vi.fn())
    const cancelled = removeImageBackground('data:image/png;base64,TWO', vi.fn(), controller.signal)

    await vi.waitFor(() => {
      expect(releaseFirst).toBeDefined()
    })

    // Closed while still queued behind inference that cannot be called back.
    controller.abort()
    releaseFirst?.()

    await expect(first).resolves.toBe('data:image/png;base64,AAAA')
    await expect(cancelled).rejects.toThrow()
    // The cancelled open never reached the model, so reopening does not have
    // to wait for a cutout no one would have seen.
    expect(entered).toEqual(['data:image/png;base64,ONE'])

    const reopened = removeImageBackground('data:image/png;base64,THREE', vi.fn())

    await expect(reopened).resolves.toBe('data:image/png;base64,AAAA')
    expect(entered).toEqual(['data:image/png;base64,ONE', 'data:image/png;base64,THREE'])
  })

  it('lets the next run through after a failure rather than wedging the queue', async () => {
    stubFileReader({ result: 'data:image/png;base64,AAAA' })
    removeBackground.mockRejectedValueOnce(new Error('WebAssembly.instantiate failed'))
    removeBackground.mockResolvedValueOnce(new Blob())

    const failed = removeImageBackground('data:image/png;base64,ONE', vi.fn())
    const next = removeImageBackground('data:image/png;base64,TWO', vi.fn())

    await expect(failed).rejects.toThrow('WebAssembly.instantiate failed')
    await expect(next).resolves.toBe('data:image/png;base64,AAAA')
  })
})
