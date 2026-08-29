import { APP_NAME, UNTITLED_PROJECT_NAME } from '@/lib/constants'
import type { PixenProject } from '@/types/project'
import { PROJECT_EXTENSION, PROJECT_FORMAT_VERSION } from '@/types/project'

/** Splits on both separators so Windows and POSIX paths behave the same. */
export const fileNameOf = (path: string): string => {
  return path.split(/[/\\]/).pop() ?? ''
}

export const baseNameOf = (path: string): string => {
  const fileName = fileNameOf(path)
  const dot = fileName.lastIndexOf('.')

  return dot > 0 ? fileName.slice(0, dot) : fileName
}

export const createProject = (name: string, image: string, now = new Date()): PixenProject => {
  const timestamp = now.toISOString()

  return {
    version: PROJECT_FORMAT_VERSION,
    name,
    source: image,
    image,
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}

/** Records a newly flattened image as the project's saved state. */
export const withSavedImage = (
  project: PixenProject,
  image: string,
  now = new Date(),
): PixenProject => {
  return { ...project, image, updatedAt: now.toISOString() }
}

/** The project name follows the file it was saved as. */
export const renameProject = (project: PixenProject, name: string): PixenProject => {
  return { ...project, name }
}

export const projectFileName = (project: PixenProject): string => {
  return `${project.name}.${PROJECT_EXTENSION}`
}

/** Save dialogs do not always append the filter's suffix on every platform. */
export const withProjectExtension = (path: string): string => {
  return path.toLowerCase().endsWith(`.${PROJECT_EXTENSION}`)
    ? path
    : `${path}.${PROJECT_EXTENSION}`
}

export const serializeProject = (project: PixenProject): string => {
  return JSON.stringify(project)
}

export interface WindowTitleInput {
  path: string | null
  hasProject: boolean
  dirty: boolean
}

export const windowTitle = ({ path, hasProject, dirty }: WindowTitleInput): string => {
  if (!hasProject) {
    return APP_NAME
  }

  const label = path ? fileNameOf(path) : UNTITLED_PROJECT_NAME

  return `${APP_NAME} — ${label}${dirty ? ' *' : ''}`
}
