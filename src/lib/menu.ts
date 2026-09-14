import { Menu, MenuItem, PredefinedMenuItem, Submenu } from '@tauri-apps/api/menu'

import { APP_NAME, CAPTURE_ACCELERATOR } from '@/lib/constants'
import { labelForRecent } from '@/lib/recent'

export interface MenuHandlers {
  onOpenImage: () => void
  /** Reopens a path from Open Recent. */
  onOpenRecent: (path: string) => void
  onClearRecent: () => void
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
 * A menu replaces the whole bar, so the standard App, Edit and Window entries
 * have to be rebuilt here — without an Edit menu the system shortcuts for
 * copy, paste and select-all stop working in text fields.
 */
export const installAppMenu = async (handlers: MenuHandlers): Promise<AppMenu> => {
  const openItem = await MenuItem.new({
    id: 'pixen-open',
    text: 'Open Image…',
    accelerator: 'Cmd+O',
    action: handlers.onOpenImage,
  })

  const recentMenu = await Submenu.new({ id: 'pixen-recent', text: 'Open Recent', items: [] })

  // The accelerator is shown, not bound: Rust registers it system-wide for the
  // tray, and a Carbon hot key is served before the menu bar sees the key.
  const captureItem = await MenuItem.new({
    id: 'pixen-capture',
    text: 'Take Screenshot…',
    accelerator: CAPTURE_ACCELERATOR,
    action: handlers.onCaptureScreen,
  })

  // Shift is deliberate: plain Cmd+C stays with the predefined Copy below, so
  // copying text in the editor keeps working.
  const copyImageItem = await MenuItem.new({
    id: 'pixen-copy-image',
    text: 'Copy Image',
    accelerator: 'Cmd+Shift+C',
    enabled: false,
    action: handlers.onCopyImage,
  })

  const arrowItem = await MenuItem.new({
    id: 'pixen-arrow',
    text: 'Arrow…',
    accelerator: 'Cmd+Shift+A',
    enabled: false,
    action: handlers.onArrow,
  })

  const pixelizeItem = await MenuItem.new({
    id: 'pixen-pixelize',
    text: 'Pixelize…',
    accelerator: 'Cmd+Shift+P',
    enabled: false,
    action: handlers.onPixelize,
  })

  const incrementItem = await MenuItem.new({
    id: 'pixen-increment',
    text: 'Numbered Steps…',
    accelerator: 'Cmd+Shift+N',
    enabled: false,
    action: handlers.onIncrement,
  })

  const cutoutItem = await MenuItem.new({
    id: 'pixen-cutout',
    text: 'Remove Background…',
    accelerator: 'Cmd+Shift+B',
    enabled: false,
    action: handlers.onCutout,
  })

  const saveItem = await MenuItem.new({
    id: 'pixen-save',
    text: 'Save',
    accelerator: 'Cmd+S',
    enabled: false,
    action: handlers.onSave,
  })

  const saveAsItem = await MenuItem.new({
    id: 'pixen-save-as',
    text: 'Save As…',
    accelerator: 'Cmd+Shift+S',
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
    text: `Quit ${APP_NAME}`,
    accelerator: 'Cmd+Q',
    action: handlers.onQuit,
  })

  const separator = () => PredefinedMenuItem.new({ item: 'Separator' })

  const fileMenu = await Submenu.new({
    text: 'File',
    items: [openItem, recentMenu, captureItem, await separator(), saveItem, saveAsItem],
  })

  const menu = await Menu.new({
    items: [
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
      // Copy Image belongs with the other clipboard entries.
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
    ],
  })

  await menu.setAsAppMenu()

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
