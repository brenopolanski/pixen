import { PlusIcon, XIcon } from '@/components/shared/Icons'
import { MAX_TABS, UNTITLED_NAME } from '@/lib/constants'
import { fileNameOf } from '@/lib/image/image'
import type { ImageTab } from '@/lib/tabs'
import { tabsFullMessage } from '@/lib/tabs'
import { cn } from '@/lib/utils'

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
  const atCap = tabs.length >= MAX_TABS
  const newTabTitle = atCap ? tabsFullMessage(MAX_TABS) : 'Open in new tab'

  return (
    <div className="flex items-center gap-1 overflow-x-auto border-t border-border px-3 py-1.5">
      {tabs.map((tab) => {
        const active = tab.id === activeId

        return (
          <div
            key={tab.id}
            className={cn(
              'flex max-w-45 shrink-0 items-center gap-1 rounded-md border px-2 py-1',
              active
                ? 'border-border bg-accent text-foreground'
                : 'border-transparent text-muted-foreground hover:bg-accent/60',
            )}
          >
            <button
              className="flex min-w-0 items-center gap-1.5 text-left"
              disabled={locked}
              type="button"
              onClick={() => onActivate(tab.id)}
            >
              <span className="max-w-[120px] truncate text-[12px] font-medium">
                {tabLabel(tab)}
              </span>
              {tab.dirty && (
                <span
                  aria-label="Unsaved changes"
                  className="size-1.5 shrink-0 rounded-full bg-brand"
                />
              )}
            </button>
            <button
              aria-label={`Close ${tabLabel(tab)}`}
              className="shrink-0 rounded-sm p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40"
              disabled={locked}
              type="button"
              onClick={() => onClose(tab.id)}
            >
              <XIcon className="size-3" />
            </button>
          </div>
        )
      })}

      <button
        aria-label={newTabTitle}
        className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
        disabled={locked || atCap}
        title={newTabTitle}
        type="button"
        onClick={onNewTab}
      >
        <PlusIcon className="size-3.5" />
      </button>
    </div>
  )
}
