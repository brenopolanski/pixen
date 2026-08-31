import { ChevronDownIcon, FileDownIcon } from '@/components/shared/Icons'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { SaveFormat } from '@/lib/image/image'
import { SAVE_FORMATS } from '@/lib/image/image'
import { generateReactKey } from '@/lib/utils'

interface ExportMenuProps {
  disabled: boolean
  format: SaveFormat
  onChange: (format: SaveFormat) => void
}

/**
 * The format lives here rather than in the save dialog because a native dialog
 * reports only a path back, never which of its file types was picked.
 */
export const ExportMenu = ({ disabled, format, onChange }: ExportMenuProps) => {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          className="h-auto gap-1.5 px-2.5 py-1.5 text-[12px]"
          disabled={disabled}
          title="Export"
          variant="outline"
        >
          <FileDownIcon className="size-3.5" />
          Export
          <ChevronDownIcon className="size-3 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="min-w-44" sideOffset={6}>
        {SAVE_FORMATS.map((option) => (
          <DropdownMenuCheckboxItem
            key={generateReactKey('format', option.id)}
            checked={option.id === format.id}
            className="gap-1.5 py-1.5 pr-2.5 text-[12px] font-medium"
            title={option.name}
            onSelect={() => onChange(option)}
          >
            {option.name}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
