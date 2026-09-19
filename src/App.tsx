import { useState } from 'react'

import { EditorPane } from '@/components/editor/EditorPane'
import { EmptyState } from '@/components/layout/EmptyState'
import { ErrorBanner } from '@/components/layout/ErrorBanner'
import { ArrowOverlay } from '@/components/overlays/ArrowOverlay'
import { CutoutOverlay } from '@/components/overlays/CutoutOverlay'
import { DropOverlay } from '@/components/overlays/DropOverlay'
import { IncrementOverlay } from '@/components/overlays/IncrementOverlay'
import { PixelizeOverlay } from '@/components/overlays/PixelizeOverlay'
import { Settings } from '@/components/settings/Settings'
import { ShortcutsDialog } from '@/components/shortcuts/ShortcutsDialog'
import { Toolbar } from '@/components/toolbar/Toolbar'
import { Toaster } from '@/components/ui/sonner'
import { useCaptureShortcut } from '@/hooks/useCaptureShortcut'
import { useClipboardPaste } from '@/hooks/useClipboardPaste'
import { useCloseGuard } from '@/hooks/useCloseGuard'
import { useEditorSettings } from '@/hooks/useEditorSettings'
import { useFileDrop } from '@/hooks/useFileDrop'
import { useImageSession } from '@/hooks/useImageSession'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { useLaunchSequence } from '@/hooks/useLaunchSequence'
import { useNativeMenu } from '@/hooks/useNativeMenu'
import { useTrayRequests } from '@/hooks/useTrayRequests'
import { useWindowTitle } from '@/hooks/useWindowTitle'
import { showAboutWindow } from '@/lib/desktop'
import { generateReactKey } from '@/lib/utils'

export const App = () => {
  const session = useImageSession()
  const { theme, setTheme } = useEditorSettings()
  const { captureAccelerator, rebindCapture } = useCaptureShortcut()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const hasImage = session.tabs.length > 0

  useLaunchSequence()
  useKeyboardShortcuts({
    hasImage,
    onArrow: session.startArrow,
    onCopyImage: session.copyImage,
    onCutout: session.startCutout,
    onIncrement: session.startIncrement,
    onOpenImage: session.openImage,
    onOpenSettings: () => {
      setSettingsOpen((prev) => !prev)
    },
    onOpenShortcuts: () => {
      setShortcutsOpen((prev) => !prev)
    },
    onPixelize: session.startPixelize,
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
    captureAccelerator,
  )
  useWindowTitle({ path: session.path, hasImage, dirty: session.dirty })
  useTrayRequests({
    onCaptureScreen: session.captureScreen,
    onQuit: session.requestClose,
  })
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
        activeOverlay={session.activeOverlay}
        busy={session.busy}
        captureAccelerator={captureAccelerator}
        format={session.format}
        hasImage={hasImage}
        overlayOpen={session.overlayOpen}
        tabs={session.tabs}
        onActivateTab={session.activateTab}
        onArrow={session.startArrow}
        onCaptureScreen={session.captureScreen}
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
        onOpenShortcuts={() => {
          setShortcutsOpen(true)
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
              key={generateReactKey('editor', tab.id)}
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

        {session.arrowPreview && (
          <ArrowOverlay
            image={session.arrowPreview}
            onApply={session.applyArrow}
            onCancel={session.cancelArrow}
            onDraftChange={session.reportArrowDraft}
          />
        )}

        {session.cutoutPreview && (
          <CutoutOverlay
            // Not using `generateReactKey` here because it's a session id and it's not a stable key.
            key={session.cutoutSession}
            image={session.cutoutPreview}
            onApply={session.applyCutout}
            onCancel={session.cancelCutout}
            onDraftChange={session.reportCutoutDraft}
            onError={session.reportError}
          />
        )}

        {session.pixelizePreview && (
          <PixelizeOverlay
            image={session.pixelizePreview}
            onApply={session.applyPixelize}
            onCancel={session.cancelPixelize}
            onDraftChange={session.reportPixelizeDraft}
          />
        )}

        {session.incrementPreview && (
          <IncrementOverlay
            image={session.incrementPreview}
            onApply={session.applyIncrement}
            onCancel={session.cancelIncrement}
            onDraftChange={session.reportIncrementDraft}
          />
        )}
      </main>

      {dragging && <DropOverlay />}

      <Settings
        captureAccelerator={captureAccelerator}
        open={settingsOpen}
        theme={theme}
        onClose={() => {
          setSettingsOpen(false)
        }}
        onRebindCapture={rebindCapture}
        onThemeChange={setTheme}
      />

      <ShortcutsDialog
        captureAccelerator={captureAccelerator}
        open={shortcutsOpen}
        onClose={() => {
          setShortcutsOpen(false)
        }}
      />

      <Toaster position="bottom-right" theme={theme} />
    </div>
  )
}
