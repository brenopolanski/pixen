import { Menu, MenuItem, PredefinedMenuItem, Submenu } from '@tauri-apps/api/menu'
import { getCurrentWindow } from '@tauri-apps/api/window'

import { APP_NAME } from '@/lib/constants'
import { labelForRecent } from '@/lib/recent'

export interface MenuHandlers {
  onOpenImage: () => void
  /** Reopens a path from Open Recent. */
  onOpenRecent: (path: string) => void
  onClearRecent: () => void
  /** Only reachable on macOS, the one platform with a capture backend. */
  onCaptureScreen: () => void
  onCopyImage: () => void
  onArrow: () => void
  onPixelize: () => void
  onIncrement: () => void
  onCutout: () => void
  onSave: () => void
  onSaveAs: () => void
  /** Opens the About window; replaces the predefined macOS About panel. */
  onAbout: () => void
  /** Runs the unsaved-changes prompt and quits; see `requestClose`. */
  onQuit: () => void
}

export interface AppMenu {
  /** Greys out the save and copy entries while there is nothing to act on. */
  setHasImage: (hasImage: boolean) => Promise<void>
  /** Refills Open Recent; the rest of the bar is left in place. */
  setRecent: (paths: readonly string[]) => Promise<void>
}

/**
 * Installs the native menu bar.
 *
 * Quit is a plain item wired to Pixen's own close handler rather than the
 * predefined one, which calls `exit` directly and would drop unsaved edits
 * without asking.
 *
 * On macOS the menu replaces the whole bar, so the standard App, Edit and
 * Window entries have to be rebuilt here — without an Edit menu the system
 * shortcuts for copy, paste and select-all stop working in text fields.
 */
export const installAppMenu = async (mac: boolean, handlers: MenuHandlers): Promise<AppMenu> => {
  const openItem = await MenuItem.new({
    id: 'pixen-open',
    text: 'Open Image…',
    accelerator: 'CmdOrCtrl+O',
    action: handlers.onOpenImage,
  })

  const recentMenu = await Submenu.new({ id: 'pixen-recent', text: 'Open Recent', items: [] })

  const captureItem = await MenuItem.new({
    id: 'pixen-capture',
    text: 'Take Screenshot…',
    action: handlers.onCaptureScreen,
  })

  // Shift is deliberate: plain Cmd+C stays with the predefined Copy below, so
  // copying text in the editor keeps working.
  const copyImageItem = await MenuItem.new({
    id: 'pixen-copy-image',
    text: 'Copy Image',
    accelerator: 'CmdOrCtrl+Shift+C',
    enabled: false,
    action: handlers.onCopyImage,
  })

  const arrowItem = await MenuItem.new({
    id: 'pixen-arrow',
    text: 'Arrow…',
    enabled: false,
    action: handlers.onArrow,
  })

  // No accelerator, like the toolbar button: it opens a selection overlay
  // rather than performing an edit outright.
  const pixelizeItem = await MenuItem.new({
    id: 'pixen-pixelize',
    text: 'Pixelize…',
    enabled: false,
    action: handlers.onPixelize,
  })

  const incrementItem = await MenuItem.new({
    id: 'pixen-increment',
    text: 'Numbered Steps…',
    enabled: false,
    action: handlers.onIncrement,
  })

  const cutoutItem = await MenuItem.new({
    id: 'pixen-cutout',
    text: 'Remove Background…',
    enabled: false,
    action: handlers.onCutout,
  })

  const saveItem = await MenuItem.new({
    id: 'pixen-save',
    text: 'Save',
    accelerator: 'CmdOrCtrl+S',
    enabled: false,
    action: handlers.onSave,
  })

  const saveAsItem = await MenuItem.new({
    id: 'pixen-save-as',
    text: 'Save As…',
    accelerator: 'CmdOrCtrl+Shift+S',
    enabled: false,
    action: handlers.onSaveAs,
  })

  const aboutItem = await MenuItem.new({
    id: 'pixen-about',
    text: `About ${APP_NAME}`,
    action: handlers.onAbout,
  })

  const quitItem = await MenuItem.new({
    id: 'pixen-quit',
    text: mac ? `Quit ${APP_NAME}` : 'Quit',
    accelerator: 'CmdOrCtrl+Q',
    action: handlers.onQuit,
  })

  const separator = () => PredefinedMenuItem.new({ item: 'Separator' })

  // Copy Image belongs with the other clipboard entries, which only macOS has;
  // elsewhere File is the only menu there is.
  const fileMenu = await Submenu.new({
    text: 'File',
    items: mac
      ? [openItem, recentMenu, captureItem, await separator(), saveItem, saveAsItem]
      : [
          openItem,
          recentMenu,
          await separator(),
          saveItem,
          saveAsItem,
          copyImageItem,
          arrowItem,
          pixelizeItem,
          incrementItem,
          cutoutItem,
          await separator(),
          aboutItem,
          quitItem,
        ],
  })

  const menu = await Menu.new({
    items: mac
      ? [
          await Submenu.new({
            text: APP_NAME,
            items: [
              aboutItem,
              await separator(),
              await PredefinedMenuItem.new({ item: 'Hide' }),
              await PredefinedMenuItem.new({ item: 'HideOthers' }),
              await PredefinedMenuItem.new({ item: 'ShowAll' }),
              await separator(),
              quitItem,
            ],
          }),
          fileMenu,
          await Submenu.new({
            text: 'Edit',
            items: [
              await PredefinedMenuItem.new({ item: 'Undo' }),
              await PredefinedMenuItem.new({ item: 'Redo' }),
              await separator(),
              await PredefinedMenuItem.new({ item: 'Cut' }),
              await PredefinedMenuItem.new({ item: 'Copy' }),
              await PredefinedMenuItem.new({ item: 'Paste' }),
              await PredefinedMenuItem.new({ item: 'SelectAll' }),
              await separator(),
              copyImageItem,
              arrowItem,
              pixelizeItem,
              incrementItem,
              cutoutItem,
            ],
          }),
          await Submenu.new({
            text: 'Window',
            items: [
              await PredefinedMenuItem.new({ item: 'Minimize' }),
              await PredefinedMenuItem.new({ item: 'Fullscreen' }),
            ],
          }),
        ]
      : [fileMenu],
  })

  // macOS menus are app-wide; elsewhere the bar belongs to this window, and
  // attaching it app-wide would put one on the splash screen too.
  if (mac) {
    await menu.setAsAppMenu()
  } else {
    await menu.setAsWindowMenu(getCurrentWindow())
  }

  const fillRecent = async (paths: readonly string[]) => {
    for (const item of await recentMenu.items()) {
      await recentMenu.remove(item)
    }

    if (paths.length === 0) {
      await recentMenu.append(
        await MenuItem.new({ id: 'pixen-recent-empty', text: 'No Recent Files', enabled: false }),
      )
    } else {
      for (const [index, path] of paths.entries()) {
        await recentMenu.append(
          await MenuItem.new({
            // Positional ids: the same path can move up the list, and reusing
            // its id for a fresh item would clash with the one being replaced.
            id: `pixen-recent-${index}`,
            text: labelForRecent(path, paths),
            action: () => handlers.onOpenRecent(path),
          }),
        )
      }
    }

    await recentMenu.append(await separator())
    await recentMenu.append(
      await MenuItem.new({
        id: 'pixen-recent-clear',
        text: 'Clear Menu',
        enabled: paths.length > 0,
        action: handlers.onClearRecent,
      }),
    )
  }

  await fillRecent([])

  // Rebuilds run one after another: two of them interleaving would leave the
  // submenu holding items from both lists.
  let pending = Promise.resolve()

  return {
    setHasImage: async (hasImage: boolean) => {
      await saveItem.setEnabled(hasImage)
      await saveAsItem.setEnabled(hasImage)
      await copyImageItem.setEnabled(hasImage)
      await arrowItem.setEnabled(hasImage)
      await pixelizeItem.setEnabled(hasImage)
      await incrementItem.setEnabled(hasImage)
      await cutoutItem.setEnabled(hasImage)
    },
    setRecent: (paths: readonly string[]) => {
      pending = pending.then(() => fillRecent(paths))

      return pending
    },
  }
}
