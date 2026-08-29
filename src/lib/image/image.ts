import { APP_NAME, UNTITLED_NAME } from '@/lib/constants'

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

export interface SaveFormat {
  /** Labels the file type in the save dialog. */
  name: string
  /** The first entry is what a path without a usable extension receives. */
  extensions: string[]
  mimeType: string
}

/** Lossless, so it is what Pixen offers first and falls back to. */
const PNG: SaveFormat = { name: 'PNG', extensions: ['png'], mimeType: 'image/png' }

export const SAVE_FORMATS: SaveFormat[] = [
  PNG,
  { name: 'JPEG', extensions: ['jpg', 'jpeg'], mimeType: 'image/jpeg' },
  { name: 'WebP', extensions: ['webp'], mimeType: 'image/webp' },
]

/**
 * Read back from the path because a save dialog only reports where to write,
 * never which file type was chosen. An unrecognised extension falls back to
 * PNG so the bytes can never disagree with the name.
 */
export const formatForPath = (path: string): SaveFormat => {
  const extension = extensionOf(path)

  return SAVE_FORMATS.find((format) => format.extensions.includes(extension)) ?? PNG
}

/** Save dialogs do not always append the filter's suffix on every platform. */
export const withImageExtension = (path: string, format: SaveFormat): string => {
  return format.extensions.includes(extensionOf(path)) ? path : `${path}.${format.extensions[0]}`
}

/** What the save dialog offers for an image that has not been saved yet. */
export const defaultFileName = (baseName: string): string => {
  return `${baseName}.${PNG.extensions[0]}`
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
