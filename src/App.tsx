import type { ImageEditorRef } from '@unlayer/react-image-editor'
import { useRef } from 'react'

import { Editor } from '@/components/Editor'
import { EmptyState } from '@/components/EmptyState'
import { ErrorBanner } from '@/components/ErrorBanner'
import { Toolbar } from '@/components/Toolbar'
import { useCloseGuard } from '@/hooks/useCloseGuard'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { useLaunchSequence } from '@/hooks/useLaunchSequence'
import { useProjectSession } from '@/hooks/useProjectSession'
import { useWindowTitle } from '@/hooks/useWindowTitle'
import { fileNameOf } from '@/lib/project/project'

const App = () => {
  const editorRef = useRef<ImageEditorRef>(null)
  const session = useProjectSession(editorRef)
  const hasProject = session.project !== null

  useLaunchSequence(session.restoreRecovery)
  useKeyboardShortcuts({
    onOpenImage: session.openImage,
    onOpenProject: session.openProject,
    onSave: session.save,
    onSaveAs: session.saveAs,
  })
  useWindowTitle({ path: session.path, hasProject, dirty: session.dirty })
  useCloseGuard(session.requestClose)

  return (
    <div className="flex h-full flex-col bg-background">
      <Toolbar
        busy={session.busy}
        dirty={session.dirty}
        fileName={session.path && fileNameOf(session.path)}
        hasProject={hasProject}
        onOpenImage={session.openImage}
        onOpenProject={session.openProject}
        onSave={session.save}
        onSaveAs={session.saveAs}
      />

      {session.error && <ErrorBanner message={session.error} onDismiss={session.dismissError} />}

      <main className="flex min-h-0 flex-1 flex-col">
        {session.loadedImage ? (
          <Editor
            editorRef={editorRef}
            image={session.loadedImage}
            onCancel={session.discardEdits}
            onError={session.reportError}
            onSave={session.save}
          />
        ) : (
          <EmptyState
            busy={session.busy}
            onOpenImage={session.openImage}
            onOpenProject={session.openProject}
          />
        )}
      </main>
    </div>
  )
}

export default App
