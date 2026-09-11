import { ChevronDownIcon, SaveIcon } from '@/components/shared/Icons'
import { Button } from '@/components/ui/button'
import { ButtonGroup, ButtonGroupSeparator } from '@/components/ui/button-group'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { SaveFormat } from '@/lib/image/image'
import { SAVE_FORMATS } from '@/lib/image/image'
import { formatShortcut } from '@/lib/shortcuts'
import { generateReactKey } from '@/lib/utils'

interface SaveMenuProps {
  busy: boolean
  format: SaveFormat
  hasImage: boolean
  onCopyImage: () => void
  onFormatChange: (format: SaveFormat) => void
  onSave: () => void
  onSaveAs: () => void
}

/**
 * The format lives here rather than in the save dialog because a native dialog
 * reports only a path back, never which of its file types was picked.
 */
export const SaveMenu = ({
  busy,
  format,
  hasImage,
  onCopyImage,
  onFormatChange,
  onSave,
  onSaveAs,
}: SaveMenuProps) => {
  const disabled = busy || !hasImage

  return (
    <ButtonGroup>
      <Button
        className="h-auto gap-1.5 rounded-r-none px-2.5 py-1.5 text-[12px]"
        disabled={disabled}
        onClick={onSave}
      >
        <SaveIcon className="size-3.5" />
        Save
      </Button>

      <ButtonGroupSeparator className="bg-primary-foreground/25" />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            aria-label="Save options"
            className="h-auto rounded-l-none px-2!"
            disabled={disabled}
          >
            <ChevronDownIcon className="size-3.5" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="start" className="min-w-52" sideOffset={6}>
          <DropdownMenuItem className="py-1.5 pr-2.5 text-[12px] font-medium" onSelect={onSave}>
            Save
            <DropdownMenuShortcut>{formatShortcut('s')}</DropdownMenuShortcut>
          </DropdownMenuItem>

          <DropdownMenuItem className="py-1.5 pr-2.5 text-[12px] font-medium" onSelect={onSaveAs}>
            Save As…
            <DropdownMenuShortcut>{formatShortcut('s', true)}</DropdownMenuShortcut>
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="py-1.5 pr-2.5 text-[12px] font-medium">
              Export as {format.name}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuLabel className="text-[11px] text-muted-foreground">
                Format
              </DropdownMenuLabel>
              {SAVE_FORMATS.map((option) => (
                <DropdownMenuCheckboxItem
                  key={generateReactKey('format', option.id)}
                  checked={option.id === format.id}
                  className="py-1.5 pr-2.5 text-[12px] font-medium"
                  onSelect={() => onFormatChange(option)}
                >
                  {option.name}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>

          <DropdownMenuItem
            className="py-1.5 pr-2.5 text-[12px] font-medium"
            onSelect={onCopyImage}
          >
            Copy to clipboard
            <DropdownMenuShortcut>{formatShortcut('c', true)}</DropdownMenuShortcut>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </ButtonGroup>
  )
}
