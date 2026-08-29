import { useEffect } from 'react'

import { setWindowTitle } from '@/lib/desktop'
import type { WindowTitleInput } from '@/lib/image/image'
import { windowTitle } from '@/lib/image/image'

export const useWindowTitle = (input: WindowTitleInput) => {
  const title = windowTitle(input)

  useEffect(() => {
    void setWindowTitle(title).catch((failure: unknown) => {
      console.error('[pixen] could not update the window title', failure)
    })
  }, [title])
}
