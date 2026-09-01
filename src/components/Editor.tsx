import type { ImageEditorRef } from '@unlayer/react-image-editor'
import ImageEditor from '@unlayer/react-image-editor'

import { EDITOR_CONTAINER_CLASS } from '@/lib/constants'
import { EDITOR_OPTIONS } from '@/lib/editor/engine'

interface EditorProps {
  editorId: string
  image: string
  onCancel: () => void
  onEditor: (editor: ImageEditorRef | null) => void
  onError: (message: string) => void
  onSave: () => void
}

/**
 * The Unlayer editor is the whole editing engine; Pixen only hands it an image
 * and turns its Save and Cancel actions into file operations. The saved image
 * is read back through the ref rather than taken from the callback, so it
 * always comes from the same source as the unsaved-changes check.
 *
 * Those two buttons are hidden in src/index.css because Pixen's own toolbar
 * covers them, but they stay wired: if a future editor build moves them out of
 * reach of that rule, they act on the project instead of going dead.
 */
export const Editor = ({ editorId, image, onCancel, onEditor, onError, onSave }: EditorProps) => {
  return (
    <div className={`${EDITOR_CONTAINER_CLASS} flex min-h-0 min-w-0 flex-1 flex-col`} id={editorId}>
      <ImageEditor
        ref={onEditor}
        editorId={editorId}
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
    </div>
  )
}
