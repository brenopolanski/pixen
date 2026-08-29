import type { CSSProperties } from 'react'
import type { ToasterProps } from 'sonner'
import { Toaster as Sonner } from 'sonner'

/**
 * shadcn's Sonner wrapper with its `next-themes` lookup dropped: Pixen ships a
 * single dark theme, so there is nothing to read. The variables map Sonner's
 * surface onto the same tokens the menus use.
 */
const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group"
      style={
        {
          '--normal-bg': 'var(--popover)',
          '--normal-text': 'var(--popover-foreground)',
          '--normal-border': 'var(--border)',
        } as CSSProperties
      }
      theme="dark"
      {...props}
    />
  )
}

export { Toaster }
