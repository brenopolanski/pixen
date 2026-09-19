import { PlusIcon, XIcon } from '@/components/shared/Icons'
import { UNTITLED_NAME } from '@/lib/constants'
import { fileNameOf } from '@/lib/image/image'
import type { ImageTab } from '@/lib/tabs'
import { cn, generateReactKey } from '@/lib/utils'

interface TabBarProps {
  tabs: ImageTab[]
  activeId: string | null
  /** Overlay or a file action — switching would drop a mid-tool selection. */
  locked: boolean
  onActivate: (tabId: string) => void
  onClose: (tabId: string) => void
  onNewTab: () => void
}

const tabLabel = (tab: ImageTab): string => {
  return tab.path ? fileNameOf(tab.path) : tab.name || UNTITLED_NAME
}

export const TabBar = ({ tabs, activeId, locked, onActivate, onClose, onNewTab }: TabBarProps) => {
  return (
    <div className="flex min-w-0 items-center gap-1 border-t border-border px-3 py-1.5">
      <div
        className="no-scrollbar flex min-w-0 scroll-fade-x items-center gap-1 overflow-x-auto"
        role="tablist"
      >
        {tabs.map((tab) => {
          const active = tab.id === activeId
          const label = tabLabel(tab)

          return (
            <div
              key={generateReactKey('tab', tab.id)}
              aria-disabled={locked || undefined}
              aria-selected={active}
              className={cn(
                'flex max-w-45 shrink-0 items-center gap-1 rounded-md border px-2 py-1 outline-none',
                active
                  ? 'border-border bg-accent text-foreground'
                  : 'border-transparent text-muted-foreground hover:bg-accent/60',
                locked ? 'opacity-40' : 'cursor-pointer',
              )}
              role="tab"
              tabIndex={locked ? -1 : active ? 0 : -1}
              title={label}
              onClick={() => {
                if (!locked) {
                  onActivate(tab.id)
                }
              }}
              onKeyDown={(event) => {
                if (locked || (event.key !== 'Enter' && event.key !== ' ')) {
                  return
                }

                event.preventDefault()
                onActivate(tab.id)
              }}
            >
              <span className="flex min-w-0 items-center gap-1.5 text-left">
                <span className="max-w-30 truncate text-[12px] font-medium">{label}</span>
                {tab.dirty && (
                  <span
                    aria-label="Unsaved changes"
                    className="size-1.5 shrink-0 rounded-full bg-brand"
                  />
                )}
              </span>
              <button
                aria-label={`Close ${label}`}
                className="shrink-0 rounded-sm p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40"
                disabled={locked}
                type="button"
                onClick={(event) => {
                  event.stopPropagation()
                  onClose(tab.id)
                }}
              >
                <XIcon className="size-3" />
              </button>
            </div>
          )
        })}
      </div>

      <button
        aria-label="Open in new tab"
        className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
        disabled={locked}
        type="button"
        onClick={onNewTab}
      >
        <PlusIcon className="size-3.5" />
      </button>
    </div>
  )
}
