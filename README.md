<p align="center">
  <img src="./src-tauri/icons/128x128.png" alt="Pixen Logo" width="128">
</p>

<h1 align="center">
  Pixen
</h1>
<p align="center">
  Open-source desktop image editor built with <a href="https://tauri.app">Tauri</a> and React.
</p>

> **Early-stage.** Pixen is at v0.1.0. It opens an image, edits it, and saves the result — nothing
> more.

Pixen is a small desktop shell around the [Unlayer Image Editor](https://unlayer.com/image-editor).
The editor does the editing; Pixen owns the window, the native file dialogs, the encoding, and the
keyboard shortcuts.

## What it does

- Opens PNG, JPEG and WebP images by dropping them on the window, pasting from the clipboard, or
  through a native file dialog
- Edits them with [`@unlayer/react-image-editor`](https://github.com/unlayer/react-image-editor) —
  crop, resize, filters, draw, text, shapes, stickers and frames
- Saves as PNG, JPEG or WebP with `⌘S` / `Ctrl+S`, asking where to write the first time and reusing
  that destination afterwards
- Saves to a new file with `⌘⇧S` / `Ctrl+Shift+S`
- Puts Open, Save and Save As in the native menu bar
- Shows a splash screen while the app and the editor engine start up
- Tracks unsaved changes in the window title (`Pixen — my-image.png *`)
- Asks before closing with unsaved work: **Save**, **Don't Save** or **Cancel**

The image you opened is never written unless you pick it in the save dialog yourself.

Not implemented: AI, plugins, accounts, cloud storage, batch processing, multiple documents,
version history, crash recovery, telemetry.

## Tech stack

- [Tauri](https://tauri.app) 2 for the native shell, windows and filesystem access
- React 19 + TypeScript + Vite for the UI
- Tailwind CSS 4
- [`@unlayer/react-image-editor`](https://www.npmjs.com/package/@unlayer/react-image-editor) as the
  editing engine
- Vitest for unit tests

## Supported platforms

| Platform | Status                                    |
| -------- | ----------------------------------------- |
| macOS    | 10.15+, built and tested                  |
| Windows  | Supported by the code; build not verified |
| Linux    | Supported by the code; build not verified |

No OS-specific paths or shortcuts are hardcoded: the primary modifier is chosen from the host
platform, and every path comes from Tauri.

## Requirements

- [pnpm](https://pnpm.io) 10
- Node.js 20+
- Rust 1.77.2+ (`rustup`)
- Platform build tools: Xcode Command Line Tools on macOS, MSVC on Windows,
  `webkit2gtk` and `libayatana-appindicator` on Linux

## Development

```bash
pnpm install
source "$HOME/.cargo/env"
pnpm tauri:dev
```

Rust must be on your `PATH`. If `cargo` is missing in an already-open terminal, run
`source "$HOME/.cargo/env"` or open a new tab.

`pnpm dev` starts the Vite UI only. Every Tauri call fails there, so use `pnpm tauri:dev` for the
real app.

Pixen loads the editor engine from `cdn.unlayer.com`, so the first launch needs an internet
connection.

## Scripts

| Script        | Description                                     |
| ------------- | ----------------------------------------------- |
| `tauri:dev`   | Run the desktop app                             |
| `tauri:build` | Build the installers for the current platform   |
| `dev`         | Vite UI only (no native shell)                  |
| `build`       | Type-check and build the frontend               |
| `test`        | Run Vitest                                      |
| `typecheck`   | `tsc --noEmit`                                  |
| `lint`        | ESLint                                          |
| `format`      | Prettier                                        |
| `icons`       | Regenerate app icons from the SVG               |
| `clean`       | Remove `dist`, `node_modules`, Rust `target`, … |
| `check:fix`   | Format, lint, type-check, and test              |

## Build

```bash
pnpm tauri:build
```

Bundles land in `src-tauri/target/release/bundle/`: `.app` and `.dmg` on macOS, an NSIS installer
on Windows, `.deb` and AppImage on Linux. Builds are unsigned, so on macOS the first launch is
right-click the app → Open.

## Opening

A drop, a paste, the File menu and the toolbar all end up in the same place: `useImageSession`
confirms unsaved work, then loads. Only where the image comes from differs.

- **Dropping** goes through the window's `onDragDropEvent`. Tauri intercepts file drops before the
  webview sees them, so `dragover` and `drop` never fire and an HTML5 drop zone would be dead. Paths
  arrive unfiltered, so Pixen takes the first PNG, JPEG or WebP and ignores the rest — it is still a
  one-document editor.
- **Pasting** listens for the `paste` event rather than binding `⌘V`, so the clipboard's contents
  decide whether Pixen acts. A paste aimed at an `input`, `textarea`, `select` or `contenteditable`
  is left alone, which is what keeps the editor's text tool working. A pasted image has no path, so
  its first save asks where to write.
- **The File menu** is built with `@tauri-apps/api/menu`, so its actions sit next to the session
  rather than in Rust. Save and Save As are disabled until an image is open. On macOS a menu replaces
  the entire bar, so the App, Edit and Window submenus are rebuilt too — without an Edit menu the
  system copy, paste and select-all shortcuts stop working in text fields.

Quit is a plain menu item wired to Pixen's own close handler, not the predefined one. The predefined
item calls `exit` directly, which would drop unsaved edits without asking.

## Saving

PNG, JPEG and WebP are picked from the selector in Pixen's own toolbar, not from the save dialog. A
native dialog only reports where to write, never which of its file types was selected, so a dialog
listing all three would advertise a choice it cannot honour — pick JPEG there and you would still get
a PNG. Instead the dialog is shown a single filter matching the toolbar, and:

- **An extension you type yourself wins.** Naming the file `photo.webp` while the selector says PNG
  saves WebP, and the selector moves to WebP to match.
- **Changing format sends the next Save through the dialog again.** The extension is part of the
  name, so reusing the old path would put JPEG bytes inside the `.png` already on disk.

### Why encoding happens in Rust

`write_image` decodes the editor's output and re-encodes it with the [`image`](https://docs.rs/image)
crate, rather than asking the webview's canvas to do it. A canvas cannot be used here because Tauri
embeds a different engine per platform and `toDataURL` disagrees across them: WebKit — WKWebView on
macOS, WebKitGTK on Linux — has never implemented WebP encoding and answers the request with PNG
instead, [silently](https://caniuse.com/mdn-api_htmlcanvaselement_toblob_type_parameter_webp). Only
WebView2 on Windows would have produced a real WebP. Encoding in Rust is the same code on all three.

Two details of that encoder:

- **WebP is lossless.** The `image` crate encodes VP8L only, which still beats PNG on size. Lossy
  WebP would mean linking libwebp and its C toolchain.
- **JPEG is composited onto white** at quality 92, since it carries no alpha channel and anything
  transparent would otherwise encode black.

Bytes already in the destination's format are written through untouched. `getImage()` hands back the
loaded source data URL verbatim while the canvas holds no objects, so saving an untouched JPEG as a
JPEG copies it rather than putting it through a second round of lossy compression. The format is
decided by sniffing the bytes rather than trusting the data URL's own media type, so what lands on
disk always agrees with the name.

### What a flattened save costs

`@unlayer/react-image-editor` exposes no serialization of its editable state. Its API offers
`getImage()` (a flattened data URL), `hasChanges()`, `reset()` and `updateOptions()` — there is no
way to read back layers, text objects or the undo stack. So a saved file is pixels and nothing else:

- **Reopening a saved image is not the same as never having closed it.** Text, shapes and stickers
  come back rasterised, not as editable objects.
- **Undo history does not survive a save or a reopen.**

Unsaved changes are derived rather than observed, for the same reason: the editor emits no change
events, so Pixen combines `hasChanges()` with a comparison against the last saved image. That
comparison uses the editor's own export, not the encoded file, so saving as JPEG does not leave the
image looking permanently unsaved.

The tool rail docks on the left (`features.imageEditor.dock`), matching the layout of most desktop
editors. The editor's own toolbar also ends with Cancel and Save buttons, which duplicate Pixen's
toolbar and native dialogs. Nothing in the editor's options turns them off, so `src/index.css`
hides that group by position and lets the zoom controls take the space. That rule depends on the
editor's DOM, so it needs a look after an editor release — the buttons stay wired to the session,
and the worst case is that they reappear rather than stop working.

## Architecture

```text
src/
├── components/          # Toolbar, Editor, EmptyState, DropOverlay, ErrorBanner, Splash
├── hooks/               # session state, drop, paste, menu, shortcuts, title, close guard, launch
└── lib/
    ├── editor/          # engine preload, editor options, unsaved-edit detection
    ├── image/           # paths and formats, clipboard reads, dialogs and I/O
    └── menu.ts          # the native menu bar

src-tauri/src/
├── image.rs             # image file I/O and PNG/JPEG/WebP encoding
├── dialog.rs            # the three-button unsaved-changes prompt
└── window.rs            # splash → main handoff, quit
```

All filesystem work happens in Rust behind narrow commands, so the webview is granted **no**
filesystem scope at all — see `src-tauri/capabilities/`. Reads are extension-checked and
size-capped, writes go through a temp file and a rename so an interrupted save cannot destroy an
existing file, and OS errors are mapped to short sentences instead of being forwarded raw.

## Keyboard shortcuts

| Shortcut               | Action                          |
| ---------------------- | ------------------------------- |
| `⌘S` / `Ctrl+S`        | Save                            |
| `⌘⇧S` / `Ctrl+Shift+S` | Save As                         |
| `⌘O` / `Ctrl+O`        | Open an image                   |
| `⌘V` / `Ctrl+V`        | Open the image on the clipboard |
| `⌘Q` / `Ctrl+Q`        | Quit, guarding unsaved work     |

## License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.
