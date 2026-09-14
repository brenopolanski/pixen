import { ShortcutRecorder } from './ShortcutRecorder'

interface CaptureSettingsProps {
  captureAccelerator: string
  onRebindCapture: (accelerator: string) => Promise<string | null>
}

export const CaptureSettings = ({ captureAccelerator, onRebindCapture }: CaptureSettingsProps) => {
  return (
    <div className="space-y-3">
      <div className="space-y-0.5">
        <span className="text-sm font-medium">Capture Screenshot</span>
        <p className="text-xs text-muted-foreground">Works from any app while Pixen is running</p>
      </div>

      <ShortcutRecorder accelerator={captureAccelerator} onRebind={onRebindCapture} />
    </div>
  )
}
