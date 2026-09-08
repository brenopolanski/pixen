import type { ImageEditorRef } from '@unlayer/react-image-editor'
import { useCallback, useState } from 'react'

import { ArrowOverlay } from '@/components/ArrowOverlay'
import { CutoutOverlay } from '@/components/CutoutOverlay'
import { DropOverlay } from '@/components/DropOverlay'
import { Editor } from '@/components/Editor'
import { EmptyState } from '@/components/EmptyState'
import { ErrorBanner } from '@/components/ErrorBanner'
import { IncrementOverlay } from '@/components/IncrementOverlay'
import { PixelizeOverlay } from '@/components/PixelizeOverlay'
import { Settings } from '@/components/settings/Settings'
import { Toolbar } from '@/components/toolbar/Toolbar'
import { Toaster } from '@/components/ui/sonner'
import { useClipboardPaste } from '@/hooks/useClipboardPaste'
import { useCloseGuard } from '@/hooks/useCloseGuard'
import { useEditorSettings } from '@/hooks/useEditorSettings'
import { useFileDrop } from '@/hooks/useFileDrop'
import { useImageSession } from '@/hooks/useImageSession'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { useLaunchSequence } from '@/hooks/useLaunchSequence'
import { useNativeMenu } from '@/hooks/useNativeMenu'
import { useWindowTitle } from '@/hooks/useWindowTitle'
import { editorContainerId } from '@/lib/constants'
import { showAboutWindow } from '@/lib/desktop'
import { isCaptureSupported } from '@/lib/image/capture'
import type { EditorTheme } from '@/lib/settings'
import type { ImageTab } from '@/lib/tabs'

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
const EditorPane = ({
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
      <Editor
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

const App = () => {
  const session = useImageSession()
  const { theme, setTheme } = useEditorSettings()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const hasImage = session.tabs.length > 0

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
      onOpenRecent: session.openRecent,
      onClearRecent: session.clearRecent,
      onCaptureScreen: session.captureScreen,
      onCopyImage: session.copyImage,
      onArrow: session.startArrow,
      onPixelize: session.startPixelize,
      onIncrement: session.startIncrement,
      onCutout: session.startCutout,
      onSave: session.save,
      onSaveAs: session.saveAs,
      onAbout: () => {
        void showAboutWindow()
      },
      onQuit: session.requestClose,
    },
    hasImage,
    session.recent,
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
        activeId={session.activeId}
        busy={session.busy}
        format={session.format}
        hasImage={hasImage}
        overlayOpen={session.overlayOpen}
        tabs={session.tabs}
        onActivateTab={session.activateTab}
        onArrow={session.startArrow}
        onCaptureScreen={isCaptureSupported() ? session.captureScreen : undefined}
        onCloseTab={session.closeTab}
        onCopyImage={session.copyImage}
        onCutout={session.startCutout}
        onFormatChange={session.setFormat}
        onIncrement={session.startIncrement}
        onOpenImage={session.openImage}
        onOpenNewTab={session.openInNewTab}
        onOpenSettings={() => {
          setSettingsOpen(true)
        }}
        onPixelize={session.startPixelize}
        onSave={session.save}
        onSaveAs={session.saveAs}
      />

      {session.error && <ErrorBanner message={session.error} onDismiss={session.dismissError} />}

      <main className="relative flex min-h-0 flex-1 flex-col">
        {hasImage ? (
          session.tabs.map((tab) => (
            <EditorPane
              key={tab.id}
              active={tab.id === session.activeId}
              tab={tab}
              theme={theme}
              onCancel={session.discardEdits}
              onEditor={session.setEditorRef}
              onError={session.reportError}
              onSave={session.save}
            />
          ))
        ) : (
          <EmptyState busy={session.busy} onOpenImage={session.openImage} />
        )}

        {session.pixelizePreview && (
          <PixelizeOverlay
            image={session.pixelizePreview}
            onApply={session.applyPixelize}
            onCancel={session.cancelPixelize}
          />
        )}

        {session.incrementPreview && (
          <IncrementOverlay
            image={session.incrementPreview}
            onApply={session.applyIncrement}
            onCancel={session.cancelIncrement}
          />
        )}

        {session.arrowPreview && (
          <ArrowOverlay
            image={session.arrowPreview}
            onApply={session.applyArrow}
            onCancel={session.cancelArrow}
          />
        )}

        {session.cutoutPreview && (
          <CutoutOverlay
            image={session.cutoutPreview}
            onApply={session.applyCutout}
            onCancel={session.cancelCutout}
            onError={session.reportError}
          />
        )}
      </main>

      {dragging && <DropOverlay />}

      <Settings
        open={settingsOpen}
        theme={theme}
        onClose={() => {
          setSettingsOpen(false)
        }}
        onThemeChange={setTheme}
      />

      {/* Last, so a toast sits above the editor and the overlays. */}
      <Toaster position="bottom-right" theme={theme} />
    </div>
  )
}

export default App
