import type { ImageEditorRef as UnlayerImageEditorRef } from '@unlayer/react-image-editor'
import UnlayerImageEditor from '@unlayer/react-image-editor'

import { useCropDoubleClick } from '@/hooks/useCropDoubleClick'
import { EDITOR_CONTAINER_CLASS } from '@/lib/constants'
import { EDITOR_OPTIONS } from '@/lib/editor/engine'
import type { EditorTheme } from '@/lib/settings'

interface EditorProps {
  editorId: string
  image: string
  theme: EditorTheme
  onCancel: () => void
  onEditor: (editor: UnlayerImageEditorRef | null) => void
  onError: (message: string) => void
  onSave: () => void
}

/**
 * The Unlayer editor is the whole editing engine; Pixen only hands it an image
 * and turns its Save and Cancel actions into file operations. The saved image
 * is read back through the ref rather than taken from the callback, so it
 * always comes from the same source as the unsaved-changes check.
 *
 * Those two buttons are hidden in src/styles/globals.css because Pixen's own toolbar
 * covers them, but they stay wired: if a future editor build moves them out of
 * reach of that rule, they act on the project instead of going dead.
 */
export const ImageEditor = ({
  editorId,
  image,
  theme,
  onCancel,
  onEditor,
  onError,
  onSave,
}: EditorProps) => {
  useCropDoubleClick(editorId)

  return (
    <div className={`flex min-h-0 min-w-0 flex-1 flex-col ${EDITOR_CONTAINER_CLASS}`} id={editorId}>
      <UnlayerImageEditor
        ref={onEditor}
        editorId={editorId}
        image={image}
        minHeight={0}
        options={{ ...EDITOR_OPTIONS, theme }}
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
