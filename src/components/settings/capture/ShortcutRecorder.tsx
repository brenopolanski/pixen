import { useEffect, useRef, useState } from 'react'

import { XIcon } from '@/components/shared/Icons'
import { Button } from '@/components/ui/button'
import { ButtonGroup, ButtonGroupText } from '@/components/ui/button-group'
import { Input } from '@/components/ui/input'
import { restoreCaptureShortcut, suspendCaptureShortcut } from '@/lib/desktop'
import {
  DEFAULT_CAPTURE_ACCELERATOR,
  eventToAccelerator,
  formatAccelerator,
  isReservedShortcut,
  setRecordingCaptureShortcut,
} from '@/lib/shortcuts'

interface ShortcutRecorderProps {
  accelerator: string
  /** Resolves with an error message when the combo was refused. */
  onRebind: (accelerator: string) => Promise<string | null>
}

/**
 * A key recorder rather than a text field: focus it and the next combo is
 * what gets bound. Listening on the window matters — a button's own keydown
 * never sees ⌘, because macOS gives that keystroke to the menu bar.
 */
export const ShortcutRecorder = ({ accelerator, onRebind }: ShortcutRecorderProps) => {
  const inputRef = useRef<HTMLInputElement>(null)
  const rebound = useRef(false)
  const [recording, setRecording] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!recording) {
      return
    }

    rebound.current = false
    setRecordingCaptureShortcut(true)
    void suspendCaptureShortcut()

    const onKeyDown = (event: KeyboardEvent) => {
      event.preventDefault()
      event.stopPropagation()

      if (event.key === 'Escape') {
        setError(null)
        setRecording(false)
        inputRef.current?.blur()
        return
      }

      const next = eventToAccelerator(event)

      if (!next) {
        return
      }

      if (isReservedShortcut(next)) {
        setError('Pixen already uses that shortcut')
        return
      }

      void onRebind(next).then((message) => {
        setError(message)
        rebound.current = message === null
        setRecording(false)
        inputRef.current?.blur()
      })
    }

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target

      if (target instanceof Node && inputRef.current?.contains(target)) {
        return
      }

      // A click away cancels the edit, so the field shows the combo still in
      // force rather than staying on the placeholder.
      setError(null)
      setRecording(false)
      inputRef.current?.blur()
    }

    window.addEventListener('keydown', onKeyDown, { capture: true })
    document.addEventListener('pointerdown', onPointerDown)

    return () => {
      window.removeEventListener('keydown', onKeyDown, { capture: true })
      document.removeEventListener('pointerdown', onPointerDown)
      setRecordingCaptureShortcut(false)

      if (!rebound.current) {
        void restoreCaptureShortcut()
      }
    }
  }, [onRebind, recording])

  return (
    <div className="flex flex-col items-start gap-1">
      <ButtonGroup className="w-full">
        <ButtonGroupText className="h-8 px-2.5 text-xs text-muted-foreground" asChild>
          <label htmlFor="capture-shortcut">Shortcut</label>
        </ButtonGroupText>
        <Input
          ref={inputRef}
          aria-invalid={error !== null}
          className="h-8 text-center text-[12px]"
          id="capture-shortcut"
          placeholder="Press shortcut…"
          value={recording ? '' : formatAccelerator(accelerator)}
          readOnly
          onFocus={() => {
            setError(null)
            setRecording(true)
          }}
        />
        <Button
          aria-label="Reset to the default shortcut"
          disabled={accelerator === DEFAULT_CAPTURE_ACCELERATOR}
          size="icon-sm"
          type="button"
          variant="outline"
          onClick={() => {
            setError(null)
            void onRebind(DEFAULT_CAPTURE_ACCELERATOR).then((message) => {
              setError(message)
            })
          }}
        >
          <XIcon className="size-3.5" />
        </Button>
      </ButtonGroup>

      {error && <p className="text-[11px] text-destructive">{error}</p>}
    </div>
  )
}
