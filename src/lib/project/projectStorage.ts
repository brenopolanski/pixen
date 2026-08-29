import { invoke } from '@tauri-apps/api/core'
import { open, save } from '@tauri-apps/plugin-dialog'

import { APP_NAME, IMAGE_EXTENSIONS } from '@/lib/constants'
import { PixenError } from '@/lib/errors'
import { serializeProject, withProjectExtension } from '@/lib/project/project'
import { parseProject, parseRecovery } from '@/lib/project/projectValidation'
import type { PixenProject, RecoverySnapshot } from '@/types/project'
import { PROJECT_EXTENSION } from '@/types/project'

const IMAGE_FILTER = { name: 'Images', extensions: [...IMAGE_EXTENSIONS] }
const PROJECT_FILTER = { name: `${APP_NAME} Project`, extensions: [PROJECT_EXTENSION] }

/** Dialogs resolve to null when the user cancels, which is never an error. */
export const pickImage = async (): Promise<string | null> => {
  const selected = await open({ directory: false, multiple: false, filters: [IMAGE_FILTER] })

  return typeof selected === 'string' ? selected : null
}

export const pickProject = async (): Promise<string | null> => {
  const selected = await open({ directory: false, multiple: false, filters: [PROJECT_FILTER] })

  return typeof selected === 'string' ? selected : null
}

export const pickProjectDestination = async (fileName: string): Promise<string | null> => {
  const selected = await save({ defaultPath: fileName, filters: [PROJECT_FILTER] })

  return selected ? withProjectExtension(selected) : null
}

/** Returns a data URL, the only image form the editor accepts. */
export const readImage = (path: string): Promise<string> => {
  return invoke('read_image', { path })
}

export const readProject = async (path: string): Promise<PixenProject> => {
  const result = parseProject(await invoke<string>('read_project', { path }))

  if (!result.ok) {
    throw new PixenError(result.message)
  }

  return result.project
}

export const writeProject = (path: string, project: PixenProject): Promise<void> => {
  return invoke('write_project', { path, contents: serializeProject(project) })
}

export const readRecovery = async (): Promise<RecoverySnapshot | null> => {
  const contents = await invoke<string | null>('read_recovery')

  return contents ? parseRecovery(contents) : null
}

export const writeRecovery = (snapshot: RecoverySnapshot): Promise<void> => {
  return invoke('write_recovery', { contents: JSON.stringify(snapshot) })
}

export const clearRecovery = (): Promise<void> => {
  return invoke('clear_recovery')
}
