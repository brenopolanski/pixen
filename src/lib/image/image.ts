import { APP_NAME, IMAGE_EXTENSIONS, UNTITLED_NAME } from '@/lib/constants'

/** Splits on both separators so Windows and POSIX paths behave the same. */
export const fileNameOf = (path: string): string => {
  return path.split(/[/\\]/).pop() ?? ''
}

export const baseNameOf = (path: string): string => {
  const fileName = fileNameOf(path)
  const dot = fileName.lastIndexOf('.')

  return dot > 0 ? fileName.slice(0, dot) : fileName
}

const extensionOf = (path: string): string => {
  const fileName = fileNameOf(path)
  const dot = fileName.lastIndexOf('.')

  return dot > 0 ? fileName.slice(dot + 1).toLowerCase() : ''
}

/**
 * Whether Pixen can open the file a path names. A drop hands over whatever the
 * user was dragging, so the list is filtered before anything reaches Rust.
 */
export const isSupportedImagePath = (path: string): boolean => {
  return (IMAGE_EXTENSIONS as readonly string[]).includes(extensionOf(path))
}

/** The first image in a drop; null when none of the files was one. */
export const firstSupportedImagePath = (paths: readonly string[]): string | null => {
  return paths.find(isSupportedImagePath) ?? null
}

export type SaveFormatId = 'png' | 'jpeg' | 'webp'

/**
 * A format the toolbar can offer. There is deliberately no media type here:
 * encoding happens in Rust, so `write_image` is the one place that maps an
 * extension onto a codec.
 */
export interface SaveFormat {
  id: SaveFormatId
  /** Labels the format in the toolbar and the save dialog. */
  name: string
  /** The first entry is what a path without a usable extension receives. */
  extensions: string[]
}

const PNG: SaveFormat = { id: 'png', name: 'PNG', extensions: ['png'] }

export const SAVE_FORMATS: SaveFormat[] = [
  PNG,
  { id: 'jpeg', name: 'JPEG', extensions: ['jpg', 'jpeg'] },
  { id: 'webp', name: 'WebP', extensions: ['webp'] },
]

export const DEFAULT_SAVE_FORMAT = PNG

export const formatById = (id: string): SaveFormat => {
  return SAVE_FORMATS.find((format) => format.id === id) ?? DEFAULT_SAVE_FORMAT
}

/** Whether a path is already named for the format, counting every alias. */
export const matchesFormat = (path: string, format: SaveFormat): boolean => {
  return format.extensions.includes(extensionOf(path))
}

/**
 * A save dialog only reports where to write, never which of its file types was
 * chosen, so the format Pixen is set to save in is the answer unless the user
 * typed an extension of their own — an explicit `.webp` outranks the selector.
 */
export const formatForPath = (path: string, chosen: SaveFormat): SaveFormat => {
  const extension = extensionOf(path)

  return SAVE_FORMATS.find((format) => format.extensions.includes(extension)) ?? chosen
}

/** Save dialogs do not always append the filter's suffix on every platform. */
export const withImageExtension = (path: string, format: SaveFormat): string => {
  return matchesFormat(path, format) ? path : `${path}.${format.extensions[0]}`
}

/** What the save dialog offers for an image that has not been saved yet. */
export const defaultFileName = (baseName: string, format: SaveFormat): string => {
  return `${baseName}.${format.extensions[0]}`
}

export interface WindowTitleInput {
  path: string | null
  hasImage: boolean
  dirty: boolean
}

export const windowTitle = ({ path, hasImage, dirty }: WindowTitleInput): string => {
  if (!hasImage) {
    return APP_NAME
  }

  const label = path ? fileNameOf(path) : UNTITLED_NAME

  return `${APP_NAME} — ${label}${dirty ? ' *' : ''}`
}
