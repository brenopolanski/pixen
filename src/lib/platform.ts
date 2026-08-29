/**
 * Every Tauri webview — WKWebView, WebView2, WebKitGTK — reports the host OS in
 * its user agent, so the primary shortcut modifier can be chosen without
 * pulling in a platform plugin.
 */
export const isMacUserAgent = (userAgent: string): boolean => /Mac OS X|Macintosh/i.test(userAgent)

let macPlatform: boolean | undefined

export const isMacPlatform = (): boolean => (macPlatform ??= isMacUserAgent(navigator.userAgent))
