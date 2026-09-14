# How it works

## Opening

A drop, a paste, the File menu and the toolbar all end up in the same place: `useImageSession`
places the image in a tab. A clean tab is replaced; a dirty tab is kept and a new one opens. The
tab strip’s **+** always creates a tab so you can keep a clean image open. Only where the image
comes from differs.

- **Dropping** goes through the window's `onDragDropEvent`. Tauri intercepts file drops before the
  webview sees them, so `dragover` and `drop` never fire and an HTML5 drop zone would be dead. Paths
  arrive unfiltered, so Pixen takes the first PNG, JPEG or WebP and ignores the rest. A clean tab is
  replaced; a dirty tab is kept and a new one opens.
- **Pasting** listens for the `paste` event rather than binding `⌘V`, so the clipboard's contents
  decide whether Pixen acts. A paste aimed at an `input`, `textarea`, `select` or `contenteditable`
  is left alone, which is what keeps the editor's text tool working. A pasted image has no path, so
  its first save asks where to write.
- **Screenshotting** runs macOS's own `screencapture -i`, so you get the crosshair you already know
  — drag a region, or press Space to pick a window. Pixen hides itself for the duration and comes
  back whatever happens. A capture has no path either, so its first save offers `Screenshot.png`.
- **The File menu** is built with `@tauri-apps/api/menu`, so its actions sit next to the session
  rather than in Rust. Save, Save As, Copy Image and the four image tools are disabled until an
  image is open. A menu replaces the entire bar, so the App, Edit and Window submenus are rebuilt
  too — without an Edit menu the system copy, paste and select-all shortcuts stop working in text
  fields.

### Open Recent

The last ten paths live in `localStorage` under `pixen.recent-files`, newest first: a list of
strings is exactly what the webview's own storage is for, and nothing here justifies a store plugin.
A path is recorded only after a read or a write has succeeded, which is why a paste or a screenshot
stays off the list until it has been saved somewhere. If a file has moved or been deleted since,
opening it fails as usual and the entry drops off in the same breath, so the menu never offers the
same dead file twice. Two files sharing a name are told apart by the folder holding them.

The submenu is refilled in place — the items are removed and appended again — because installing a
menu replaces the whole bar, and rebuilding it on every open would take the App, Edit and Window
submenus with it. `Clear Menu` empties the list and the storage key with it.

Quit is a plain menu item wired to Pixen's own close handler, not the predefined one. The predefined
item calls `exit` directly, which would drop unsaved edits without asking.

About is a custom item for the same reason: the predefined macOS About panel is Apple's generic
credits sheet, not Pixen's window. `About Pixen` invokes `show_about_window`, which builds a small
window on demand (`index.html?window=about`) or focuses it if it is already open. `⌘W` / `Escape`
close it.

### Screenshots

**Take Screenshot** shells out to `/usr/sbin/screencapture`, which is what gives Pixen the same
crosshair as `⌘⇧4` without shipping a capture stack of its own. Two things to know:

- **The first capture asks for Screen Recording permission**, and macOS grants it to a specific app
  binary. A dev build's path changes as it is rebuilt, so the prompt can reappear or the capture can
  come back blank; confirm the permission against a real `pnpm tauri:build` app.
- **Cancelling is silent and leaves the open image alone.** Escape cancels, and holding Control
  sends the shot to the clipboard instead of to Pixen. Neither produces a file, and the missing file
  is how cancellation is detected — `screencapture`'s exit code is undocumented.

Capturing over unsaved edits asks before replacing them, the same as any other way of opening.

## The menu bar item

Pixen is a Dock app that also puts an item in the menu bar, so a screenshot does not need the
editor window in front first. The activation policy is left alone — this is a second way in, not a
conversion into a menu-bar-only app.

`setup_tray` in `src-tauri/src/tray.rs` builds it with `show_menu_on_left_click(false)`, which is
what splits the two gestures the way [Lightshot](https://app.prntscr.com/en/) does: left-click
captures, right-click opens **Take Screenshot**, **Start at Login**, **About Pixen** and **Quit**.
The icon is a template image, so macOS tints it to match a light or a dark menu bar.

### Why the tray does not capture directly

It could call `capture_screen` itself, but the shot would then have nowhere to go. Landing an image
is the session's job: it decides whether to replace a clean tab or open a new one, and it asks
before dropping marks that an open tool has not baked yet. So the tray emits
`pixen-capture-requested` on the main window and `useTrayRequests` calls `session.captureScreen()`
— the same entry point as the toolbar button. Quit works the same way, through
`pixen-quit-requested` and `requestClose`, rather than DefiLlama Search's `app.exit(0)`, which
would take unsaved edits with it.

### The global shortcut

`⌘⇧9` is registered with `tauri-plugin-global-shortcut` in Rust, not in `useKeyboardShortcuts`: a
webview key handler only runs while Pixen is focused, and the point of the shortcut is capturing
whatever app is in front. The File menu's **Take Screenshot…** shows the same accelerator without
binding it — macOS serves the Carbon hot key before the menu bar sees the key.

Four things can now ask for a capture at once, and `screencapture` owns the screen while it runs,
so `capture.rs` holds an in-flight flag and reports a second request as a cancellation instead of
starting a second crosshair.

### Start at Login

`tauri-plugin-autostart`, toggled from the check item. A packaged build turns it on once on first
launch and drops a marker file in the app config directory, so unchecking it stays unchecked. Debug
builds skip that entirely — otherwise `tauri dev` would register the debug binary to launch at
login. Both plugins are driven from Rust only, so neither is granted anything in
`capabilities/default.json`.

## Copying

`⌘⇧C` puts the edited image on the system clipboard, so an annotated screenshot can go straight into
a chat or a ticket without becoming a file first. A toast confirms it; there is no other feedback a
clipboard write can honestly give. The toast is raised by the session rather than by the menu, so a
copy from the keyboard or the native Edit menu says so too.

- **The clipboard carries pixels, not a file**, so the toolbar's format selector does not apply and
  the receiving app decides how to store what it gets. If a tool overlay still has unapplied marks,
  Copy asks Apply / Don't Apply / Cancel first — Apply bakes then copies; it does not save.
  `copy_image` hands over raw RGBA:
  [`arboard`](https://docs.rs/arboard), under `tauri-plugin-clipboard-manager`, then offers it to
  the pasteboard as TIFF, transparency included.
- **Shift is part of the shortcut on purpose.** Plain `⌘C` belongs to the system Copy, which the
  editor's text tool and Pixen's own inputs need, so Copy Image takes the shifted variant that other
  editors use for the same job. It sits in the Edit menu, next to that system Copy.
- **The plugin is registered for its Rust API only.** Nothing on the webview side calls it, so no
  clipboard permission is granted in `src-tauri/capabilities/` — the same arrangement as the file
  commands.

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
- **`⌘⇧P` opens it**, same as the Edit menu and the Tools grid. It still only starts the overlay —
  the box is drawn with the mouse — and it does nothing when no image is open. It sits in the Edit
  menu beside Copy Image.

## Numbering steps

**Steps** does what you would otherwise do by hand with the text tool: click the first thing the
reader should look at, then the second, and each click drops the next number. Backspace takes the
last one back, Escape or **Cancel** throws the lot away, and **Done** writes them onto the image.

- **The badges are not baked until Done.** They stay overlay elements while you work, which is what
  lets the counter count and Backspace undo. Applying on each click would reload the editor once per
  number — and, since every apply would start over, never get past 1.
- **Done flattens once**, on the same terms as Pixelize: the save path, file name and unsaved marker
  survive, the editor's undo history does not. See [flattening costs](#what-a-flattened-save-costs).
  Opening another tool or image while badges are waiting asks Apply / Don't Apply / Cancel. Apply
  flattens them the same way **Done** does; it does not write a file.
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
- **`⌘⇧N` opens it** (Numbered Steps). Same rules as the other overlay shortcuts: nothing happens
  without an image, and repeating it while Steps is already open does not prompt.

## Pointing at things

**Arrow** is the other half of a step-by-step guide: drag from somewhere clear towards whatever the
reader should look at, and the head lands where you let go. Draw as many as the picture needs,
Backspace takes the last one back, Escape or **Cancel** throws the lot away, and **Done** writes them
onto the image.

- **The tail is refused in the letterbox, the tip is clamped into it.** Starting off the picture is a
  miss, and a miss should not cost the arrows drawn so far, so `clickToPixel` reports it and the
  press is ignored. Dragging past the edge is how you point at something on the rim, though, so
  `clampPixel` in `src/lib/image/arrow.ts` pulls the tip back onto the image instead of refusing it.
  A drag shorter than an arrowhead is a slip of the mouse and is dropped.
- **Preview and composite share their geometry.** `arrowOutline` returns where the shaft stops and
  the three points of the head, and both the SVG in `ArrowOverlay` and the canvas in `composeArrows`
  draw from it, so an arrow is baked exactly where it was shown. The metrics are in image pixels and
  the overlay scales them by `displayedScale`, the same arrangement the step badges use.
- **The compositing is canvas, not Rust**, for the same reason as the badges: the shapes are cheap to
  draw in the webview, and PNG keeps alpha on the way back to the editor.
- **One colour, one thickness**, matching the step badges so a guide annotated with both looks like
  one kit rather than two tools.
- **Done flattens once**, on the same terms as Pixelize and Steps: the save path, file name and
  unsaved marker survive, the editor's undo history does not. See
  [flattening costs](#what-a-flattened-save-costs). Opening another tool or image while arrows
  are waiting asks Apply / Don't Apply / Cancel. Apply is the same flatten; it does not save.
- **`⌘⇧A` opens it**, same as Pixelize's `⌘⇧P`. Repeating the shortcut while the overlay is already
  open does nothing, so it does not ask to apply marks you have not finished.

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
  [flattening costs](#what-a-flattened-save-costs). Opening another tool or image once the preview
  is ready asks Apply / Don't Apply / Cancel. Apply is the same flatten; it does not save. A run
  that is still in flight has nothing to bake, so leaving just closes.
- **The result is transparent, so save it as PNG.** The cutout is nothing but an alpha channel, and
  JPEG has none — saving to JPEG composites the transparency onto white, exactly as it does for any
  other transparent image. WebP keeps it. Pixen does not switch the format selector for you.
- **`⌘⇧B` opens it**, matching the Tools grid's Background label. The native menu still reads
  **Remove Background…**.

## Saving

PNG, JPEG and WebP are picked from **Save → Export as** in Pixen's toolbar, not from the save
dialog. A native dialog only reports where to write, never which of its file types was selected, so
a dialog listing all three would advertise a choice it cannot honour — pick JPEG there and you would
still get a PNG. Instead the dialog is shown a single filter matching the selected format, and:

- **An extension you type yourself wins.** Naming the file `photo.webp` while **Export as** says PNG
  saves WebP, and the menu moves to WebP to match.
- **Changing format sends the next Save through the dialog again.** The extension is part of the
  name, so reusing the old path would put JPEG bytes inside the `.png` already on disk.

### Why encoding happens in Rust

`write_image` decodes the editor's output and re-encodes it with the [`image`](https://docs.rs/image)
crate, rather than asking the webview's canvas to do it. A canvas cannot be used here because
WKWebView, the engine Tauri embeds on macOS, has never implemented WebP encoding and answers the
request with PNG instead,
[silently](https://caniuse.com/mdn-api_htmlcanvaselement_toblob_type_parameter_webp). Asking for a
WebP save would quietly hand back a PNG.

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

Double-clicking inside the crop box is the same kind of DOM coupling. The engine has no apply-crop
API; leaving Crop (closing the panel or switching tools) is what commits the selection. Pixen
listens for a double-click on `.cropper-crop-box` and clicks the panel's close control
(`native-tool-options-close`) so the crop goes through Unlayer's own undoable path. Resize handles
are ignored, and a double-click while another tool is open is left alone so the text tool's
double-click-to-edit still works. The selectors need a look after an editor release too.

The hook is attached after the editor container exists. If the close button is missing, the
double-click is a no-op rather than falling through to Save.

The Settings sheet stores preferences in `localStorage` under `pixen.settings`. Theme
(`light` or `dark`) paints Pixen's chrome — empty state, toolbar, sheets — by toggling `.dark` on
`<html>`, and is also passed to Unlayer beside the stable `EDITOR_OPTIONS` object. Unlayer applies
it with `updateOptions()`, so changing theme does not remount the editor or wipe undo. The class is
set from `readSettings()` before React mounts so the empty state does not flash the wrong palette.

## Architecture

```text
src/
├── components/          # Toolbar, TabBar, Editor, Settings, EmptyState, overlays, ErrorBanner, Splash, About
│   └── ui/              # shadcn/ui primitives: Button, DropdownMenu, Sheet, Popover, Tooltip, the Sonner toaster
├── hooks/               # session state, drop, paste, menu, shortcuts, tray requests, title, close guard, launch, settings, crop double-click
└── lib/
    ├── editor/          # engine preload, editor options, unsaved-edit detection, crop double-click
    ├── image/           # paths and formats, clipboard, capture, pixelize, badge and arrow geometry, cutout, dialogs and I/O
    ├── recent.ts        # last-opened paths for File → Open Recent
    ├── overlay.ts       # whether leaving a tool should ask to bake marks
    ├── settings.ts      # localStorage preferences (theme)
    ├── tabs.ts          # replace-if-clean / new-tab decisions
    └── menu.ts          # the native menu bar

scripts/
└── fetch-bg-removal-assets.mjs   # vendors the segmentation model into public/

src-tauri/src/
├── image.rs             # image file I/O, PNG/JPEG/WebP encoding, the pixelize mosaic
├── capture.rs           # macOS interactive screen capture
├── clipboard.rs         # copying the edited image out as pixels
├── dialog.rs            # the three-button unsaved-changes prompt
├── tray.rs              # menu bar item, Start at Login, the global capture shortcut
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
