import type { ReactNode } from 'react'

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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { formatShortcut } from '@/lib/shortcuts'
import { generateReactKey } from '@/lib/utils'

interface ToolItem {
  /** What the menu shows, and the key the list is sorted on. */
  label: string
  disabled: boolean
  icon: ReactNode
  shortcut?: string
  onSelect: () => void
}

interface ToolsMenuProps {
  busy: boolean
  hasImage: boolean
  mac: boolean
  onArrow: () => void
  onCaptureScreen?: () => void
  onCopyImage: () => void
  onCutout: () => void
  onIncrement: () => void
  onPixelize: () => void
}

export const ToolsMenu = ({
  busy,
  hasImage,
  mac,
  onArrow,
  onCaptureScreen,
  onCopyImage,
  onCutout,
  onIncrement,
  onPixelize,
}: ToolsMenuProps) => {
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
      icon: <WandSparklesIcon className="size-3.5" />,
      onSelect: onCutout,
    },
    {
      label: 'Copy',
      disabled: busy || !hasImage,
      icon: <CopyIcon className="size-3.5" />,
      shortcut: formatShortcut(mac, 'c', true),
      // Confirmed by a toast from the session, so this closes like the rest:
      // the confirmation no longer needs the menu to stay open to be seen.
      onSelect: onCopyImage,
    },
    {
      label: 'Pixelize',
      disabled: busy || !hasImage,
      icon: <Grid2x2Icon className="size-3.5" />,
      onSelect: onPixelize,
    },
    {
      label: 'Steps',
      disabled: busy || !hasImage,
      icon: <ListOrderedIcon className="size-3.5" />,
      onSelect: onIncrement,
    },
  ]

  if (onCaptureScreen) {
    items.push({
      label: 'Screenshot',
      disabled: busy,
      icon: <CameraIcon className="size-3.5" />,
      onSelect: onCaptureScreen,
    })
  }

  // Sorted on what the user reads, so the order does not depend on which
  // optional tools are present.
  items.sort((left, right) => left.label.localeCompare(right.label))

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          className="h-auto gap-1.5 px-2.5 py-1.5 text-[12px]"
          title="Tools"
          variant="outline"
        >
          <WrenchIcon className="size-3.5" />
          Tools
          <ChevronDownIcon className="size-3 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="min-w-44" sideOffset={6}>
        {items.map((item) => (
          <DropdownMenuItem
            key={generateReactKey('tool', item.label)}
            className="gap-1.5 px-2.5 py-1.5 text-[12px] font-medium [&_svg]:text-foreground"
            disabled={item.disabled}
            title={item.shortcut ? `${item.label} (${item.shortcut})` : item.label}
            onSelect={item.onSelect}
          >
            {item.icon}
            {item.label}
            {item.shortcut && (
              <DropdownMenuShortcut className="text-[11px] tracking-normal">
                {item.shortcut}
              </DropdownMenuShortcut>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
