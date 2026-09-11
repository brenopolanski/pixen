import type { ReactNode } from 'react'
import { useRef, useState } from 'react'

import {
  CameraIcon,
  ChevronDownIcon,
  CopyIcon,
  Grid2x2Icon,
  ListOrderedIcon,
  MoveUpRightIcon,
  WandSparklesIcon,
  WrenchIcon,
} from '@/components/shared/Icons'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { formatShortcut } from '@/lib/shortcuts'
import { generateReactKey } from '@/lib/utils'

interface ToolItem {
  /** What the grid shows, and the key the list is sorted on. */
  label: string
  disabled: boolean
  icon: ReactNode
  shortcut?: string
  onSelect: () => void
}

interface ToolsMenuProps {
  busy: boolean
  hasImage: boolean
  onArrow: () => void
  onCaptureScreen: () => void
  onCopyImage: () => void
  onCutout: () => void
  onIncrement: () => void
  onPixelize: () => void
}

/**
 * A grid rather than a list: the tools are picked by their icon far more often
 * than they are read, and six of them fit in two rows.
 */
export const ToolsMenu = ({
  busy,
  hasImage,
  onArrow,
  onCaptureScreen,
  onCopyImage,
  onCutout,
  onIncrement,
  onPixelize,
}: ToolsMenuProps) => {
  const [open, setOpen] = useState(false)
  const [tooltip, setTooltip] = useState<string | null>(null)
  const hovering = useRef<string | null>(null)

  const closeMenu = () => {
    setOpen(false)
    setTooltip(null)
    hovering.current = null
  }

  const items: ToolItem[] = [
    {
      label: 'Arrow',
      disabled: busy || !hasImage,
      icon: <MoveUpRightIcon className="size-3.5" />,
      onSelect: onArrow,
    },
    {
      label: 'Background',
      disabled: busy || !hasImage,
      icon: <WandSparklesIcon className="size-5" />,
      onSelect: onCutout,
    },
    {
      label: 'Copy',
      disabled: busy || !hasImage,
      icon: <CopyIcon className="size-5" />,
      shortcut: formatShortcut('c', true),
      // Confirmed by a toast from the session, so this closes like the rest:
      // the confirmation no longer needs the menu to stay open to be seen.
      onSelect: onCopyImage,
    },
    {
      label: 'Pixelize',
      disabled: busy || !hasImage,
      icon: <Grid2x2Icon className="size-5" />,
      onSelect: onPixelize,
    },
    {
      label: 'Screenshot',
      disabled: busy,
      icon: <CameraIcon className="size-5" />,
      onSelect: onCaptureScreen,
    },
    {
      label: 'Steps',
      disabled: busy || !hasImage,
      icon: <ListOrderedIcon className="size-5" />,
      onSelect: onIncrement,
    },
  ]

  // Sorted on what the user reads, so the grid does not depend on the order
  // the items happen to be declared in.
  items.sort((left, right) => left.label.localeCompare(right.label))

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) {
          setTooltip(null)
          hovering.current = null
        }
      }}
    >
      <PopoverTrigger asChild>
        <Button className="h-auto gap-1.5 px-2.5 py-1.5 text-[12px]" variant="outline">
          <WrenchIcon className="size-3.5" />
          Tools
          <ChevronDownIcon className="size-3 text-muted-foreground" />
        </Button>
      </PopoverTrigger>

      {/* Radix focuses the first grid button on open; a Tooltip treats that
          focus as a hover. Skip auto-focus and only open a label from the
          pointer, so Arrow does not flash the instant the menu appears. */}
      <PopoverContent
        align="end"
        className="w-60 p-3"
        sideOffset={6}
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <TooltipProvider delayDuration={300}>
          <div className="grid grid-cols-3 gap-2">
            {items.map((item) => (
              <Tooltip
                key={generateReactKey('tool', item.label)}
                open={tooltip === item.label}
                onOpenChange={(next) => {
                  if (next) {
                    if (hovering.current === item.label) {
                      setTooltip(item.label)
                    }

                    return
                  }

                  setTooltip((current) => (current === item.label ? null : current))
                }}
              >
                <TooltipTrigger asChild>
                  <button
                    className="flex flex-col items-center gap-1.5 rounded-lg p-1 text-muted-foreground hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
                    disabled={item.disabled}
                    type="button"
                    onClick={() => {
                      closeMenu()
                      item.onSelect()
                    }}
                    onPointerEnter={() => {
                      hovering.current = item.label
                    }}
                    onPointerLeave={() => {
                      if (hovering.current === item.label) {
                        hovering.current = null
                      }

                      setTooltip((current) => (current === item.label ? null : current))
                    }}
                  >
                    <span className="flex size-12 items-center justify-center rounded-xl border border-border bg-muted/40 text-foreground">
                      {item.icon}
                    </span>
                    <span className="max-w-full text-[11px] font-medium">{item.label}</span>
                  </button>
                </TooltipTrigger>

                <TooltipContent side="top">
                  {item.shortcut ? `${item.label} (${item.shortcut})` : item.label}
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
        </TooltipProvider>
      </PopoverContent>
    </Popover>
  )
}
