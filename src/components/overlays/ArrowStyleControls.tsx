import { PlusIcon } from '@/components/shared/Icons'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Slider } from '@/components/ui/slider'
import { ARROW_COLOR } from '@/lib/image/arrow'
import { cn, generateReactKey } from '@/lib/utils'

interface ArrowStyleControlsProps {
  color: string
  stroke: number
  onColorChange: (color: string) => void
  onStrokeChange: (stroke: number) => void
}

const SWATCHES = [
  { color: ARROW_COLOR, label: 'Red' },
  { color: '#ffffff', label: 'White' },
  { color: '#111111', label: 'Black' },
  { color: '#f5d90a', label: 'Yellow' },
  { color: '#3b82f6', label: 'Blue' },
] as const

const sameColor = (left: string, right: string): boolean =>
  left.toLowerCase() === right.toLowerCase()

export const ArrowStyleControls = ({
  color,
  stroke,
  onColorChange,
  onStrokeChange,
}: ArrowStyleControlsProps) => {
  const isPreset = SWATCHES.some((swatch) => sameColor(swatch.color, color))

  return (
    <div className="flex min-w-0 items-center gap-3">
      <div aria-label="Arrow color" className="flex items-center gap-1" role="radiogroup">
        {SWATCHES.map((swatch) => {
          const selected = sameColor(swatch.color, color)

          return (
            <button
              key={generateReactKey('arrow-swatch', swatch.color)}
              aria-checked={selected}
              aria-label={swatch.label}
              className={cn(
                'size-5 rounded-full border border-border shadow-xs',
                selected && 'ring-2 ring-ring ring-offset-1 ring-offset-background',
              )}
              role="radio"
              style={{ backgroundColor: swatch.color }}
              type="button"
              onClick={() => {
                onColorChange(swatch.color)
              }}
            />
          )
        })}

        <Popover>
          <PopoverTrigger asChild>
            <button
              aria-label="Custom color"
              className={cn(
                'grid size-5 place-items-center rounded-full border border-dashed border-border text-muted-foreground',
                !isPreset && 'border-solid ring-2 ring-ring ring-offset-1 ring-offset-background',
              )}
              style={!isPreset ? { backgroundColor: color } : undefined}
              type="button"
            >
              {isPreset && <PlusIcon className="size-3" aria-hidden />}
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-auto p-2">
            <input
              aria-label="Custom arrow color"
              className="size-8 cursor-pointer border-0 bg-transparent p-0"
              type="color"
              value={color}
              onChange={(event) => {
                onColorChange(event.target.value)
              }}
            />
          </PopoverContent>
        </Popover>
      </div>

      <Slider
        aria-label="Stroke"
        className="w-24"
        max={16}
        min={4}
        step={1}
        value={[stroke]}
        onValueChange={(values) => {
          const next = values[0]

          if (next !== undefined) {
            onStrokeChange(next)
          }
        }}
      />
    </div>
  )
}
