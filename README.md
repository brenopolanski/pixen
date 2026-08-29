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

- Opens PNG, JPEG and WebP images through a native file dialog
- Edits them with [`@unlayer/react-image-editor`](https://github.com/unlayer/react-image-editor) —
  crop, resize, filters, draw, text, shapes, stickers and frames
- Saves as PNG, JPEG or WebP with `⌘S` / `Ctrl+S`, asking where to write the first time and reusing
  that destination afterwards
- Saves to a new file with `⌘⇧S` / `Ctrl+Shift+S`
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

## Saving

The save dialog offers PNG, JPEG and WebP, and the extension on the path you choose decides the
encoding. A dialog only reports where to write, never which file type was selected, so Pixen reads
the format back off the path — and falls back to PNG for an extension it cannot encode, which is
what GTK dialogs leave you with when they do not append a suffix.

The editor's output is always re-encoded into the target format rather than written through. That is
not an optimisation: `getImage()` hands back the loaded source data URL verbatim while the canvas
holds no objects, so an opened JPEG comes back as JPEG and would otherwise land behind a `.png`
name. `write_image` then re-checks the data URL's media type against the destination's extension, so
the bytes on disk always agree with the name. JPEG gets a white fill first, since it carries no alpha
channel and anything transparent would otherwise encode black.

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

The editor's toolbar also ends with its own Cancel and Save buttons, which duplicate Pixen's
toolbar and native dialogs. Nothing in the editor's options turns them off, so `src/index.css`
hides that group by position and lets the zoom controls take the space. That rule depends on the
editor's DOM, so it needs a look after an editor release — the buttons stay wired to the session,
and the worst case is that they reappear rather than stop working.

## Architecture

```text
src/
├── components/          # Toolbar, Editor, EmptyState, ErrorBanner, Splash
├── hooks/               # session state, shortcuts, window title, close guard, launch
└── lib/
    ├── editor/          # engine preload, editor options, unsaved-edit detection
    └── image/           # paths and formats, canvas re-encoding, dialogs and I/O

src-tauri/src/
├── image.rs             # image file I/O
├── dialog.rs            # the three-button unsaved-changes prompt
└── window.rs            # splash → main handoff, quit
```

All filesystem work happens in Rust behind narrow commands, so the webview is granted **no**
filesystem scope at all — see `src-tauri/capabilities/`. Reads are extension-checked and
size-capped, writes go through a temp file and a rename so an interrupted save cannot destroy an
existing file, and OS errors are mapped to short sentences instead of being forwarded raw.

## Keyboard shortcuts

| Shortcut               | Action        |
| ---------------------- | ------------- |
| `⌘S` / `Ctrl+S`        | Save          |
| `⌘⇧S` / `Ctrl+Shift+S` | Save As       |
| `⌘O` / `Ctrl+O`        | Open an image |

## License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.
