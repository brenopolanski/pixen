import { invoke } from '@tauri-apps/api/core'
import { open, save } from '@tauri-apps/plugin-dialog'

import { IMAGE_EXTENSIONS } from '@/lib/constants'
import { defaultFileName, formatForPath, SAVE_FORMATS, withImageExtension } from '@/lib/image/image'

const OPEN_FILTER = { name: 'Images', extensions: [...IMAGE_EXTENSIONS] }
const SAVE_FILTERS = SAVE_FORMATS.map(({ name, extensions }) => ({ name, extensions }))

/** Dialogs resolve to null when the user cancels, which is never an error. */
export const pickImage = async (): Promise<string | null> => {
  const selected = await open({ directory: false, multiple: false, filters: [OPEN_FILTER] })

  return typeof selected === 'string' ? selected : null
}

/** Returns a path whose extension is always one Pixen can encode. */
export const pickSaveDestination = async (baseName: string): Promise<string | null> => {
  const selected = await save({ defaultPath: defaultFileName(baseName), filters: SAVE_FILTERS })

  return selected ? withImageExtension(selected, formatForPath(selected)) : null
}

/** Returns a data URL, the only image form the editor accepts. */
export const readImage = (path: string): Promise<string> => {
  return invoke('read_image', { path })
}

export const writeImage = (path: string, dataUrl: string): Promise<void> => {
  return invoke('write_image', { path, dataUrl })
}
