import { useEffect, useState, useSyncExternalStore } from 'react'

import { Button } from '@/components/ui/button'
import { getAppVersion } from '@/lib/desktop'
import type { ResourceProbe } from '@/lib/image/cutout'
import {
  dismissCutoutDiagnostic,
  formatCutoutDiagnostic,
  getCutoutDiagnostic,
  subscribeCutoutDiagnostic,
} from '@/lib/image/cutout'

const line = (label: string, value: string | number | boolean | null): string => {
  return `${label}: ${value === null ? '—' : String(value)}`
}

interface ProbeProps {
  title: string
  probe: ResourceProbe | null
}

const Probe = ({ title, probe }: ProbeProps) => {
  return (
    <section className="flex flex-col gap-0.5">
      <p className="font-medium text-foreground">{title}</p>
      {probe ? (
        <>
          <p>{line('URL', probe.url)}</p>
          <p>{line('HTTP status', probe.status)}</p>
          <p>{line('ok', probe.ok)}</p>
          <p>{line('Content-Type', probe.contentType)}</p>
          <p>{line('Blob size', probe.blobSize)}</p>
          <p>{line('error', probe.error)}</p>
        </>
      ) : (
        <p>Not checked yet.</p>
      )}
    </section>
  )
}

/**
 * Support panel for background removal. Opened with ⌘⇧D0. It only reads the
 * diagnostic state; it does not start or change a removal.
 */
export const CutoutDiagnosticPanel = () => {
  const diagnostic = useSyncExternalStore(subscribeCutoutDiagnostic, getCutoutDiagnostic)
  const [version, setVersion] = useState('unavailable')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let active = true

    void getAppVersion()
      .then((next) => {
        if (active && next) {
          setVersion(next)
        }
      })
      .catch(() => undefined)

    return () => {
      active = false
    }
  }, [])

  if (!diagnostic) {
    return null
  }

  const runtime = navigator.userAgent

  const copy = () => {
    const report = formatCutoutDiagnostic(diagnostic, { version, runtime })

    void navigator.clipboard.writeText(report).then(() => {
      setCopied(true)
    })
  }

  return (
    <aside className="absolute top-3 right-3 z-50 flex max-h-[80vh] w-[28rem] flex-col gap-3 overflow-auto rounded-lg border border-border bg-background p-3 text-[11px] break-all text-muted-foreground shadow-xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium text-foreground">Diagnostics</p>
          <p>Support details for background removal. Not an editing tool.</p>
        </div>
        <div className="flex shrink-0 gap-1.5">
          <Button className="h-auto px-2 py-1 text-[11px]" variant="outline" onClick={copy}>
            {copied ? 'Copied' : 'Copy Diagnostics'}
          </Button>
          <Button
            className="h-auto px-2 py-1 text-[11px]"
            variant="outline"
            onClick={dismissCutoutDiagnostic}
          >
            Close
          </Button>
        </div>
      </div>

      <p>{line('App version', version)}</p>
      <p>{line('Runtime', runtime)}</p>
      <p>{line('Public Path', diagnostic.publicPath)}</p>
      <p>{line('resources.json URL', diagnostic.resourcesJsonUrl)}</p>

      <Probe probe={diagnostic.resources} title="resources.json" />
      <Probe probe={diagnostic.wasm} title="WASM chunk" />
      <Probe probe={diagnostic.mjs} title="MJS chunk" />

      <section className="flex flex-col gap-0.5">
        <p className="font-medium text-foreground">Background removal</p>
        <p>{line('Status', diagnostic.result)}</p>
        <p>{line('Last error', diagnostic.message)}</p>
        {diagnostic.stack && <pre className="whitespace-pre-wrap">{diagnostic.stack}</pre>}
      </section>
    </aside>
  )
}
