import type { ImageEditorRef } from '@unlayer/react-image-editor'
import ImageEditor from '@unlayer/react-image-editor'
import type { RefObject } from 'react'

import { EDITOR_OPTIONS } from '@/lib/editor/engine'

interface EditorProps {
  editorRef: RefObject<ImageEditorRef | null>
  image: string
  onCancel: () => void
  onError: (message: string) => void
  onSave: () => void
}

/**
 * The Unlayer editor is the whole editing engine; Pixen only hands it an image
 * and turns its Save and Cancel actions into project operations. The saved
 * image is read back through the ref rather than taken from the callback, so it
 * always comes from the same source as the unsaved-changes check.
 */
export const Editor = ({ editorRef, image, onCancel, onError, onSave }: EditorProps) => {
  return (
    <ImageEditor
      ref={editorRef}
      image={image}
      minHeight={0}
      options={EDITOR_OPTIONS}
      onCancel={onCancel}
      onError={(failure) => {
        console.error('[pixen] image editor failure', failure)
        onError('The image editor could not start. Check your connection and try again.')
      }}
      onLoadError={() => {
        onError('Pixen could not load this image into the editor.')
      }}
      onSave={onSave}
    />
  )
}
