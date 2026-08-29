import type { ImageEditorRef } from '@unlayer/react-image-editor'
import { useRef } from 'react'

import { DropOverlay } from '@/components/DropOverlay'
import { Editor } from '@/components/Editor'
import { EmptyState } from '@/components/EmptyState'
import { ErrorBanner } from '@/components/ErrorBanner'
import { Toolbar } from '@/components/Toolbar'
import { useClipboardPaste } from '@/hooks/useClipboardPaste'
import { useCloseGuard } from '@/hooks/useCloseGuard'
import { useFileDrop } from '@/hooks/useFileDrop'
import { useImageSession } from '@/hooks/useImageSession'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { useLaunchSequence } from '@/hooks/useLaunchSequence'
import { useNativeMenu } from '@/hooks/useNativeMenu'
import { useWindowTitle } from '@/hooks/useWindowTitle'
import { isCaptureSupported } from '@/lib/image/capture'
import { fileNameOf } from '@/lib/image/image'

const App = () => {
  const editorRef = useRef<ImageEditorRef>(null)
  const session = useImageSession(editorRef)
  const hasImage = session.image !== null

  useLaunchSequence()
  useKeyboardShortcuts({
    onCopyImage: session.copyImage,
    onOpenImage: session.openImage,
    onSave: session.save,
    onSaveAs: session.saveAs,
  })
  useNativeMenu(
    {
      onOpenImage: session.openImage,
      onCaptureScreen: session.captureScreen,
      onCopyImage: session.copyImage,
      onSave: session.save,
      onSaveAs: session.saveAs,
      onQuit: session.requestClose,
    },
    hasImage,
  )
  useWindowTitle({ path: session.path, hasImage, dirty: session.dirty })
  useCloseGuard(session.requestClose)
  useClipboardPaste({
    onOpenDataUrl: session.openFromDataUrl,
    onReject: session.reportError,
  })

  const dragging = useFileDrop({
    onOpenPath: session.openFromPath,
    onReject: session.reportError,
  })

  return (
    <div className="relative flex h-full flex-col bg-background">
      <Toolbar
        busy={session.busy}
        copied={session.copied}
        dirty={session.dirty}
        fileName={session.path && fileNameOf(session.path)}
        format={session.format}
        hasImage={hasImage}
        onCaptureScreen={isCaptureSupported() ? session.captureScreen : undefined}
        onCopyImage={session.copyImage}
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

      {dragging && <DropOverlay />}
    </div>
  )
}

export default App
