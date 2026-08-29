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
- Captures a region of the screen straight into the editor (macOS only)
- Edits them with [`@unlayer/react-image-editor`](https://github.com/unlayer/react-image-editor) —
  crop, resize, filters, draw, text, shapes, stickers and frames
- Saves as PNG, JPEG or WebP with `⌘S` / `Ctrl+S`, asking where to write the first time and reusing
  that destination afterwards
- Saves to a new file with `⌘⇧S` / `Ctrl+Shift+S`
- Copies the edited image to the system clipboard with `⌘⇧C` / `Ctrl+Shift+C`
- Hides private data — an address, a token, a face — behind a mosaic, by dragging a box over it
- Numbers a screenshot for a step-by-step guide: click each spot and the badge counts itself up
- Cuts the background away from the subject with a local segmentation model, previewing the result
  before it is applied
- Puts Open, Screenshot, Copy Image, Pixelize, Numbered Steps, Remove Background, Save and Save As
  in the native menu bar
- Opens an About window from the App menu on macOS, or the File menu on Windows and Linux
- Shows a splash screen while the app and the editor engine start up
- Tracks unsaved changes in the window title (`Pixen — my-image.png *`)
- Asks before closing with unsaved work: **Save**, **Don't Save** or **Cancel**

The image you opened is never written unless you pick it in the save dialog yourself.

Not implemented: plugins, accounts, cloud storage, batch processing, multiple documents, version
history, crash recovery, telemetry. The only model Pixen runs is the background segmentation one,
and it runs on your machine.

## Tech stack

- [Tauri](https://tauri.app) 2 for the native shell, windows and filesystem access
- React 19 + TypeScript + Vite for the UI
- Tailwind CSS 4, with [shadcn/ui](https://ui.shadcn.com) primitives in `src/components/ui/`
- [`@unlayer/react-image-editor`](https://www.npmjs.com/package/@unlayer/react-image-editor) as the
  editing engine
- [`@imgly/background-removal`](https://www.npmjs.com/package/@imgly/background-removal) on
  `onnxruntime-web` for background removal — see [License](#license), it is AGPL
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
pnpm assets:bg-removal
source "$HOME/.cargo/env"
pnpm tauri:dev
```

`assets:bg-removal` downloads the segmentation model into `public/bg-removal/` (76 MB, gitignored).
It is needed once per checkout, and only for the background removal tool — everything else works
without it. `tauri:build` runs it for you.

Rust must be on your `PATH`. If `cargo` is missing in an already-open terminal, run
`source "$HOME/.cargo/env"` or open a new tab.

`pnpm dev` starts the Vite UI only. Every Tauri call fails there, so use `pnpm tauri:dev` for the
real app.

Pixen loads the editor engine from `cdn.unlayer.com`, so the first launch needs an internet
connection.

## Scripts

| Script              | Description                                       |
| ------------------- | ------------------------------------------------- |
| `tauri:dev`         | Run the desktop app                               |
| `tauri:build`       | Build the installers for the current platform     |
| `dev`               | Vite UI only (no native shell)                    |
| `build`             | Type-check and build the frontend                 |
| `assets:bg-removal` | Download the background removal model to `public` |
| `test`              | Run Vitest                                        |
| `typecheck`         | `tsc --noEmit`                                    |
| `lint`              | ESLint                                            |
| `format`            | Prettier                                          |
| `icons`             | Regenerate app icons from the SVG                 |
| `clean`             | Remove `dist`, `node_modules`, Rust `target`, …   |
| `check:fix`         | Format, lint, type-check, and test                |

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
- **Screenshotting** runs macOS's own `screencapture -i`, so you get the crosshair you already know
  — drag a region, or press Space to pick a window. Pixen hides itself for the duration and comes
  back whatever happens. A capture has no path either, so its first save offers `Screenshot.png`.
- **The File menu** is built with `@tauri-apps/api/menu`, so its actions sit next to the session
  rather than in Rust. Save, Save As, Copy Image and the three image tools are disabled until an
  image is open. On macOS a
  menu replaces the entire bar, so the App, Edit and Window submenus are rebuilt too — without an
  Edit menu the system copy, paste and select-all shortcuts stop working in text fields.

Quit is a plain menu item wired to Pixen's own close handler, not the predefined one. The predefined
item calls `exit` directly, which would drop unsaved edits without asking.

About is a custom item for the same reason: the predefined macOS About panel is Apple's generic
credits sheet, not Pixen's window. `About Pixen` invokes `show_about_window`, which builds a small
window on demand (`index.html?window=about`) or focuses it if it is already open. `⌘W` / `Escape`
close it.

### Screenshots are macOS-only for now

The button and the menu item are absent on Windows and Linux, both of which would need a capture
stack of their own — and none of them offer a crosshair, which is the part that makes this worth
having. Two things to know on macOS:

- **The first capture asks for Screen Recording permission**, and macOS grants it to a specific app
  binary. A dev build's path changes as it is rebuilt, so the prompt can reappear or the capture can
  come back blank; confirm the permission against a real `pnpm tauri:build` app.
- **Cancelling is silent and leaves the open image alone.** Escape cancels, and holding Control
  sends the shot to the clipboard instead of to Pixen. Neither produces a file, and the missing file
  is how cancellation is detected — `screencapture`'s exit code is undocumented.

Capturing over unsaved edits asks before replacing them, the same as any other way of opening.

## Copying

`⌘⇧C` / `Ctrl+Shift+C` puts the edited image on the system clipboard, so an annotated screenshot can
go straight into a chat or a ticket without becoming a file first. A toast confirms it; there is no
other feedback a clipboard write can honestly give. The toast is raised by the session rather than by
the menu, so a copy from the keyboard or the native Edit menu says so too.

Unlike the screenshot, this works on all three platforms.

- **The clipboard carries pixels, not a file**, so the toolbar's format selector does not apply and
  the receiving app decides how to store what it gets. `copy_image` hands over raw RGBA:
  [`arboard`](https://docs.rs/arboard), under `tauri-plugin-clipboard-manager`, then offers it as
  TIFF on macOS, a DIB on Windows and `image/png` on Linux. Transparency survives on all three.
- **Shift is part of the shortcut on purpose.** Plain `⌘C` belongs to the system Copy, which the
  editor's text tool and Pixen's own inputs need, so Copy Image takes the shifted variant that other
  editors use for the same job. It sits in the Edit menu on macOS, next to that system Copy, and in
  the File menu on Windows and Linux, where there is no Edit menu.
- **The plugin is registered for its Rust API only.** Nothing on the webview side calls it, so no
  clipboard permission is granted in `src-tauri/capabilities/` — the same arrangement as the file
  commands. It is pure Rust on every platform, so Linux gains no new system libraries.

## Pixelizing

**Pixelize** hides something you would rather not publish — an email address, an IP, a token — under
a mosaic of averaged 12-pixel blocks. Drag a box over it and let go; there is no Apply step. Escape
or **Cancel** closes without touching the image, and a stray click does the same.

- **The selection is made on a still copy, not on the live canvas.** The editor reports neither its
  zoom nor where the image sits on screen, so a box drawn over it could not be mapped back to
  pixels. `PixelizeOverlay` covers the editor with the flattened image at a known `contain` fit, and
  `src/lib/image/pixelize.ts` converts the drag into pixel coordinates from that.
- **It flattens, like a save does.** The mosaic is applied to the image the editor currently shows,
  and the result is loaded back in, so the editor's own undo history goes with it — pixelize is not
  something Undo can take back. What survives is the document: the save path, the file name and the
  unsaved marker, so `⌘S` still writes where it wrote before. The
  [flattening costs](#what-a-flattened-save-costs) are the same ones a save pays.
- **The mosaic is computed in Rust and stays a PNG in memory.** `pixelize_image` averages every
  channel including alpha, so a mosaic over a transparent PNG stays transparent rather than growing
  a grey square. This is an edit passing through, not a save, so the toolbar's format has no say in
  it. The region is clamped to the image on both sides of the boundary.
- **No keyboard shortcut.** It opens a drag-to-select overlay rather than finishing on its own, so a
  keystroke would only ever get you halfway. It sits in the Edit menu on macOS beside Copy Image,
  and in the File menu elsewhere.

## Numbering steps

**Steps** does what you would otherwise do by hand with the text tool: click the first thing the
reader should look at, then the second, and each click drops the next number. Backspace takes the
last one back, Escape or **Cancel** throws the lot away, and **Done** writes them onto the image.

- **The badges are not baked until Done.** They stay overlay elements while you work, which is what
  lets the counter count and Backspace undo. Applying on each click would reload the editor once per
  number — and, since every apply would start over, never get past 1.
- **Done flattens once**, on the same terms as Pixelize: the save path, file name and unsaved marker
  survive, the editor's undo history does not. See [flattening costs](#what-a-flattened-save-costs).
- **The compositing is canvas, not Rust.** The mosaic belongs in Rust because it only averages
  pixels, but a badge has a digit in it, and drawing a digit needs a font — one the webview already
  has and the Rust binary would have to bundle. `src/lib/image/increment.ts` draws the circles and
  numbers onto a canvas and exports a PNG, so alpha survives and the toolbar's format stays out of
  it.
- **Clicks are mapped through the same geometry as Pixelize.** `IncrementOverlay` shows the
  flattened image at a known `contain` fit, and `clickToPixel` / `pixelToDisplayed` in
  `src/lib/image/pixelize.ts` convert between the two. A click in the letterbox margin is ignored
  rather than closing the tool, since you are mid-sequence. A badge dropped near an edge is nudged
  inwards so it is not sliced in half, and the preview is nudged with it.
- **One size, one colour, starting at 1.** Shutter's tool has no settings either, and a screenshot
  wants the numbers to look the same as each other more than it wants them configurable.

## Removing a background

**Background** in the Tools menu — **Remove Background…** in the native menu — runs a segmentation
model over the image and keeps only what it thinks is the subject. The overlay shows a progress bar
while it works, then the cutout on a checkerboard. **Apply** writes it to the document, Escape or
**Cancel** leaves the image exactly as it was.

- **The model runs on your machine and the image goes nowhere.** `@imgly/background-removal` is
  ONNX inference in the webview through `onnxruntime-web`, and `pnpm assets:bg-removal` vendors the
  weights into `public/bg-removal/` so nothing is fetched at runtime either. The library would
  otherwise pull them from `staticimgly.com` on first use; Pixen's CSP does not allow that origin,
  and if the assets are missing the tool says to run the script rather than reaching for the CDN.
- **It is the quantized ISNet, ~44 MB of the 76 MB the script downloads.** The rest is the
  onnxruntime WASM, in both the WebGPU and CPU builds, because which one loads depends on the
  machine. `isnet_fp16` is the same model at twice the size if edges ever need to be better; it is
  one constant in `src/lib/image/cutout.ts` and one entry in the fetch script.
- **The bundle carries a second, unused copy of that WASM.** `onnxruntime-web` references its own
  `.wasm` through `import.meta.url`, so Vite emits it (~23 MB) even though the library overwrites
  `ort.env.wasm.wasmPaths` with the vendored files before it creates a session. Dropping it would
  mean deleting a bundle asset by name from the Vite config, which would break quietly the day that
  override changes, so the weight is left in for now.
- **Inference is single-threaded, on purpose.** Threading it would mean `SharedArrayBuffer`, which
  needs COOP/COEP, which turns on cross-origin isolation — and that blocks every embed that does not
  opt in, including the Unlayer editor iframe. A slower cutout beats no editor. Expect a few seconds
  on a screenshot, and longer the first time while the model is read in.
- **There is a preview because the model guesses.** Hair, glass and thin lines are where it goes
  wrong, and applying reloads the editor, so a bad result has to be refusable while the original is
  still there. Cancelling mid-run closes the overlay, though the inference already in flight cannot
  be called back — the library offers no cancellation.
- **Apply flattens**, on the same terms as Pixelize and Steps: the save path, file name and unsaved
  marker survive, the editor's undo history does not. See
  [flattening costs](#what-a-flattened-save-costs).
- **The result is transparent, so save it as PNG.** The cutout is nothing but an alpha channel, and
  JPEG has none — saving to JPEG composites the transparency onto white, exactly as it does for any
  other transparent image. WebP keeps it. Pixen does not switch the format selector for you.
- **No keyboard shortcut**, for the same reason as Pixelize: it opens a mode rather than finishing
  on its own.

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
├── components/          # Toolbar, Editor, EmptyState, DropOverlay, PixelizeOverlay, IncrementOverlay, CutoutOverlay, ErrorBanner, Splash, About
│   └── ui/              # shadcn/ui primitives: Button, DropdownMenu, the Sonner toaster
├── hooks/               # session state, drop, paste, menu, shortcuts, title, close guard, launch
└── lib/
    ├── editor/          # engine preload, editor options, unsaved-edit detection
    ├── image/           # paths and formats, clipboard, capture, pixelize and badge geometry, cutout, dialogs and I/O
    └── menu.ts          # the native menu bar

scripts/
└── fetch-bg-removal-assets.mjs   # vendors the segmentation model into public/

src-tauri/src/
├── image.rs             # image file I/O, PNG/JPEG/WebP encoding, the pixelize mosaic
├── capture.rs           # macOS interactive screen capture
├── clipboard.rs         # copying the edited image out as pixels
├── dialog.rs            # the three-button unsaved-changes prompt
└── window.rs            # splash → main handoff, About window, quit
```

The primitives under `components/ui/` are the generated shadcn files, themed to Pixen's own tokens
rather than the default zinc palette: `index.css` aliases shadcn's semantic names onto the existing
`--brand`, `--surface` and `--danger`, so `Button` and `DropdownMenu` inherit the app's dark theme
and nothing has to be restyled per component. Native dialogs, the editor and the overlays stay as
they are; the primitives cover buttons, menus and toasts only.

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
| `⌘⇧C` / `Ctrl+Shift+C` | Copy the image to the clipboard |
| `⌘Q` / `Ctrl+Q`        | Quit, guarding unsaved work     |
| `⌘W` / `Ctrl+W`        | Close the About window          |
| `Escape`               | Close the About window          |

## License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.

Background removal uses [`@imgly/background-removal`](https://github.com/imgly/background-removal-js),
which is **AGPL-3.0**. Pixen's own source stays MIT, but that dependency's terms apply to anyone
distributing a build of Pixen that includes it — IMG.LY sells a commercial licence for use that AGPL
does not cover. Nothing else in the dependency tree is copyleft.
