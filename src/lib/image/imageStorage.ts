import { invoke } from '@tauri-apps/api/core'
import { open, save } from '@tauri-apps/plugin-dialog'

import { IMAGE_EXTENSIONS } from '@/lib/constants'
import type { SaveFormat } from '@/lib/image/image'
import { defaultFileName, formatForPath, withImageExtension } from '@/lib/image/image'

const OPEN_FILTER = { name: 'Images', extensions: [...IMAGE_EXTENSIONS] }

/** Dialogs resolve to null when the user cancels, which is never an error. */
export const pickImage = async (): Promise<string | null> => {
  const selected = await open({ directory: false, multiple: false, filters: [OPEN_FILTER] })

  return typeof selected === 'string' ? selected : null
}

/**
 * Offers only the format Pixen is set to save in. Listing all of them would
 * advertise a choice the dialog cannot report back, leaving the user to pick
 * JPEG and receive a PNG.
 *
 * Returns a path whose extension is always one Pixen can encode.
 */
export const pickSaveDestination = async (
  baseName: string,
  format: SaveFormat,
): Promise<string | null> => {
  const selected = await save({
    defaultPath: defaultFileName(baseName, format),
    filters: [{ name: format.name, extensions: format.extensions }],
  })

  return selected ? withImageExtension(selected, formatForPath(selected, format)) : null
}

/** Returns a data URL, the only image form the editor accepts. */
export const readImage = (path: string): Promise<string> => {
  return invoke('read_image', { path })
}

export const writeImage = (path: string, dataUrl: string): Promise<void> => {
  return invoke('write_image', { path, dataUrl })
}
