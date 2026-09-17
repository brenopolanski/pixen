import type { ImageEditorRef } from '@unlayer/react-image-editor'
import { useCallback } from 'react'

import { editorContainerId } from '@/lib/constants'
import type { EditorTheme } from '@/lib/settings'
import type { ImageTab } from '@/lib/tabs'

import { ImageEditor } from './ImageEditor'

interface EditorPaneProps {
  tab: ImageTab
  active: boolean
  theme: EditorTheme
  onCancel: () => void
  onEditor: (tabId: string, editor: ImageEditorRef | null) => void
  onError: (message: string) => void
  onSave: () => void
}

/** Owns a stable callback ref so the editor is not remounted on every render. */
export const EditorPane = ({
  tab,
  active,
  theme,
  onCancel,
  onEditor,
  onError,
  onSave,
}: EditorPaneProps) => {
  const bindEditor = useCallback(
    (editor: ImageEditorRef | null) => {
      onEditor(tab.id, editor)
    },
    [onEditor, tab.id],
  )

  return (
    <div
      className={
        active ? 'flex min-h-0 flex-1 flex-col' : 'pointer-events-none invisible absolute inset-0'
      }
    >
      <ImageEditor
        editorId={editorContainerId(tab.id)}
        image={tab.image}
        theme={theme}
        onCancel={onCancel}
        onEditor={bindEditor}
        onError={onError}
        onSave={onSave}
      />
    </div>
  )
}
