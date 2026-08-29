import { describe, expect, it } from 'vitest'

import { isMacUserAgent } from './platform'

describe('isMacUserAgent', () => {
  it('detects the macOS webview', () => {
    expect(
      isMacUserAgent(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko)',
      ),
    ).toBe(true)
  })

  it('rejects Windows and Linux webviews', () => {
    expect(isMacUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Edg/120.0.0.0')).toBe(false)
    expect(isMacUserAgent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36')).toBe(false)
  })
})
