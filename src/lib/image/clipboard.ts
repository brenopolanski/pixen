import { PixenError } from '@/lib/errors'

/** The media types Pixen can open, so the ones worth taking off a clipboard. */
const PASTEABLE_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp']

const TEXT_ENTRY_TAGS = ['INPUT', 'TEXTAREA', 'SELECT']

/** The parts of an element a paste decision depends on. */
export interface PasteTarget {
  tagName: string
  isContentEditable: boolean
}

/** The parts of `DataTransfer` this module reads. */
export interface ClipboardContents {
  files: ArrayLike<File>
  items: ArrayLike<DataTransferItem>
}

export const isSupportedImageType = (mimeType: string): boolean => {
  return PASTEABLE_MIME_TYPES.includes(mimeType)
}

/**
 * Whether a paste belongs to whatever has focus rather than to Pixen. The
 * editor's text tool and its own inputs have to keep their normal paste, so
 * only pastes aimed at nothing in particular open an image.
 */
export const isTextEntryTarget = (target: PasteTarget | null): boolean => {
  if (!target) {
    return false
  }

  return target.isContentEditable || TEXT_ENTRY_TAGS.includes(target.tagName.toUpperCase())
}

const filesIn = (transfer: ClipboardContents): File[] => {
  const fromItems = Array.from(transfer.items)
    .filter((item) => item.kind === 'file')
    .map((item) => item.getAsFile())
    .filter((file): file is File => file !== null)

  return [...Array.from(transfer.files), ...fromItems]
}

/**
 * The first image on the clipboard. A screenshot arrives as a single unnamed
 * image, while a file copied in a file manager has a name attached.
 */
export const pastedImage = (transfer: ClipboardContents | null): File | null => {
  if (!transfer) {
    return null
  }

  return filesIn(transfer).find((file) => isSupportedImageType(file.type)) ?? null
}

/**
 * Whether the clipboard holds an image Pixen cannot open, which is worth an
 * error rather than silence. A clipboard holding text is not.
 */
export const hasUnsupportedImage = (transfer: ClipboardContents | null): boolean => {
  if (!transfer) {
    return false
  }

  return Array.from(transfer.items).some(
    (item) =>
      item.kind === 'file' && item.type.startsWith('image/') && !isSupportedImageType(item.type),
  )
}

/** The editor only accepts data URLs, which is also what `write_image` reads. */
export const readAsDataUrl = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    const fail = () => reject(new PixenError('Pixen could not read the pasted image.'))

    reader.addEventListener(
      'load',
      () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result)
          return
        }

        fail()
      },
      { once: true },
    )

    reader.addEventListener('error', fail, { once: true })
    reader.readAsDataURL(file)
  })
}
