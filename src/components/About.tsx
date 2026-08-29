import { useEffect, useState } from 'react'

import { PixenLogo } from '@/components/shared/Icons'
import { APP_NAME } from '@/lib/constants'
import { closeCurrentWindow, getAppVersion } from '@/lib/desktop'

export const About = () => {
  const [version, setVersion] = useState('')

  useEffect(() => {
    let active = true

    void getAppVersion().then((next) => {
      if (active) {
        setVersion(next)
      }
    })

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' || (event.key === 'w' && (event.metaKey || event.ctrlKey))) {
        event.preventDefault()
        void closeCurrentWindow()
      }
    }

    window.addEventListener('keydown', onKeyDown)

    return () => {
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [])

  return (
    <div
      className="flex h-full flex-col items-center justify-center gap-5 bg-background px-8 text-center fade-in"
      data-tauri-drag-region
    >
      <PixenLogo className="size-24" />

      <div className="flex flex-col gap-1">
        <p className="text-[15px] font-semibold text-foreground">{APP_NAME}</p>
        <p className="h-4 text-[13px] text-muted-foreground">{version && `Version ${version}`}</p>
      </div>

      <p className="text-[12px] leading-relaxed text-muted-foreground">
        © {new Date().getFullYear()} Breno Polanski. MIT License.
      </p>
    </div>
  )
}
