<p align="center">
  <img src="./src-tauri/icons/128x128.png" alt="Pixen Logo" width="128">
</p>

<h1 align="center">
  Pixen
</h1>
<p align="center">
  Open-source desktop image editor built with <a href="https://tauri.app">Tauri</a> and React.
</p>

> **Early-stage.** Pixen is at v0.1.0. It opens an image, edits it, and saves a reopenable
> project — nothing more. The `.pix` format is intentionally minimal and will change.

Pixen is a small desktop shell around the [Unlayer Image Editor](https://unlayer.com/image-editor).
The editor does the editing; Pixen owns the window, the native file dialogs, the project format,
and the keyboard shortcuts.

## What it does

- Opens PNG, JPEG and WebP images through a native file dialog
- Edits them with [`@unlayer/react-image-editor`](https://github.com/unlayer/react-image-editor) —
  crop, resize, filters, draw, text, shapes, stickers and frames
- Saves the work as a `.pix` project with `⌘S` / `Ctrl+S`, asking for a location the first time
- Saves to a new file with `⌘⇧S` / `Ctrl+Shift+S`
- Reopens a `.pix` project and restores the image so editing can continue
- Shows a splash screen while the app and the editor engine start up
- Tracks unsaved changes in the window title (`Pixen — my-image.pix *`)
- Asks before closing with unsaved work: **Save**, **Don't Save** or **Cancel**
- Keeps a crash-recovery snapshot in the app data folder and offers to restore it on next launch

Not implemented: AI, plugins, accounts, cloud storage, batch processing, multiple documents,
version history, telemetry.

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

## Project format (`.pix`)

A `.pix` file is JSON with a version field:

```json
{
  "version": 1,
  "name": "my-image",
  "source": "data:image/png;base64,…",
  "image": "data:image/png;base64,…",
  "createdAt": "2026-01-02T03:04:05.000Z",
  "updatedAt": "2026-01-02T03:14:15.000Z"
}
```

- `source` is the image as it was first opened, kept untouched.
- `image` is the flattened result of the last save, and is what the editor reloads.

Opening a project with an unrecognised `version` fails with
_"This Pixen project uses an unsupported version."_ rather than being read anyway, so a newer
project is never overwritten with a downgraded copy.

### The V1 limitation

`@unlayer/react-image-editor` exposes no serialization of its editable state. Its API offers
`getImage()` (a flattened data URL), `hasChanges()`, `reset()` and `updateOptions()` — there is no
way to read back layers, text objects or the undo stack. So V1 stores the flattened image, which
means:

- **Reopening a project is not the same as never having closed it.** Text, shapes and stickers come
  back rasterised into the image, not as editable objects.
- **Undo history does not survive a save or a reopen.**
- Images are base64 inside JSON, so a `.pix` is roughly a third larger than the raw pixels.

`source` is stored precisely so a later format version can keep real editable state alongside it
without breaking v1 files.

Unsaved changes are derived rather than observed, for the same reason: the editor emits no change
events, so Pixen combines `hasChanges()` with a comparison against the last saved image.

## Architecture

```text
src/
├── components/          # Toolbar, Editor, EmptyState, ErrorBanner, Splash
├── hooks/               # session state, shortcuts, window title, close guard, launch
├── lib/
│   ├── editor/          # engine preload, editor options, unsaved-edit detection
│   └── project/         # project model, validation, storage
└── types/project.ts     # the .pix format

src-tauri/src/
├── project.rs           # image and project file I/O
├── dialog.rs            # the three-button unsaved-changes prompt
└── window.rs            # splash → main handoff, quit
```

All filesystem work happens in Rust behind narrow commands, so the webview is granted **no**
filesystem scope at all — see `src-tauri/capabilities/`. Reads are extension-checked and
size-capped, writes go through a temp file and a rename so an interrupted save cannot destroy an
existing project, and OS errors are mapped to short sentences instead of being forwarded raw.

Recovery snapshots live in the app data folder, never beside the user's files, and the user's `.pix`
is only ever written by an explicit save.

## Keyboard shortcuts

| Shortcut               | Action                |
| ---------------------- | --------------------- |
| `⌘S` / `Ctrl+S`        | Save the project      |
| `⌘⇧S` / `Ctrl+Shift+S` | Save As               |
| `⌘O` / `Ctrl+O`        | Open an image         |
| `⌘⇧O` / `Ctrl+Shift+O` | Open a `.pix` project |

## License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.
