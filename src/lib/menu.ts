import { Menu, MenuItem, PredefinedMenuItem, Submenu } from '@tauri-apps/api/menu'
import { getCurrentWindow } from '@tauri-apps/api/window'

import { APP_NAME } from '@/lib/constants'

export interface MenuHandlers {
  onOpenImage: () => void
  /** Only reachable on macOS, the one platform with a capture backend. */
  onCaptureScreen: () => void
  onCopyImage: () => void
  onPixelize: () => void
  onSave: () => void
  onSaveAs: () => void
  /** Runs the unsaved-changes prompt and quits; see `requestClose`. */
  onQuit: () => void
}

export interface AppMenu {
  /** Greys out the save and copy entries while there is nothing to act on. */
  setHasImage: (hasImage: boolean) => Promise<void>
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

  // No accelerator, like the toolbar button: it opens a selection overlay
  // rather than performing an edit outright.
  const pixelizeItem = await MenuItem.new({
    id: 'pixen-pixelize',
    text: 'Pixelize…',
    enabled: false,
    action: handlers.onPixelize,
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
      ? [openItem, captureItem, await separator(), saveItem, saveAsItem]
      : [
          openItem,
          await separator(),
          saveItem,
          saveAsItem,
          copyImageItem,
          pixelizeItem,
          await separator(),
          quitItem,
        ],
  })

  const menu = await Menu.new({
    items: mac
      ? [
          await Submenu.new({
            text: APP_NAME,
            items: [
              await PredefinedMenuItem.new({ item: { About: null } }),
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
              pixelizeItem,
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

  return {
    setHasImage: async (hasImage: boolean) => {
      await saveItem.setEnabled(hasImage)
      await saveAsItem.setEnabled(hasImage)
      await copyImageItem.setEnabled(hasImage)
      await pixelizeItem.setEnabled(hasImage)
    },
  }
}
