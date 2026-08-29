import type { ImageEditorRef } from '@unlayer/react-image-editor'
import { useRef } from 'react'

import { Editor } from '@/components/Editor'
import { EmptyState } from '@/components/EmptyState'
import { ErrorBanner } from '@/components/ErrorBanner'
import { Toolbar } from '@/components/Toolbar'
import { useCloseGuard } from '@/hooks/useCloseGuard'
import { useImageSession } from '@/hooks/useImageSession'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { useLaunchSequence } from '@/hooks/useLaunchSequence'
import { useWindowTitle } from '@/hooks/useWindowTitle'
import { fileNameOf } from '@/lib/image/image'

const App = () => {
  const editorRef = useRef<ImageEditorRef>(null)
  const session = useImageSession(editorRef)
  const hasImage = session.image !== null

  useLaunchSequence()
  useKeyboardShortcuts({
    onOpenImage: session.openImage,
    onSave: session.save,
    onSaveAs: session.saveAs,
  })
  useWindowTitle({ path: session.path, hasImage, dirty: session.dirty })
  useCloseGuard(session.requestClose)

  return (
    <div className="flex h-full flex-col bg-background">
      <Toolbar
        busy={session.busy}
        dirty={session.dirty}
        fileName={session.path && fileNameOf(session.path)}
        format={session.format}
        hasImage={hasImage}
        onFormatChange={session.setFormat}
        onOpenImage={session.openImage}
        onSave={session.save}
        onSaveAs={session.saveAs}
      />

      {session.error && <ErrorBanner message={session.error} onDismiss={session.dismissError} />}

      <main className="flex min-h-0 flex-1 flex-col">
        {session.image ? (
          <Editor
            editorRef={editorRef}
            image={session.image}
            onCancel={session.discardEdits}
            onError={session.reportError}
            onSave={session.save}
          />
        ) : (
          <EmptyState busy={session.busy} onOpenImage={session.openImage} />
        )}
      </main>
    </div>
  )
}

export default App
