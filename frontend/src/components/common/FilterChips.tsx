import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface FilterChipOption<T extends string> {
  value: T
  label: string
  /** Tailwind background class for a leading colour dot (e.g. severity). */
  dot?: string
}

/**
 * Multi-select toggle chips for one filter dimension. Selecting nothing
 * means "no filter" for that dimension; callers decide how to read it.
 */
export function FilterChips<T extends string>({
  label,
  options,
  value,
  onChange,
  className,
}: {
  label: string
  options: FilterChipOption<T>[]
  value: T[]
  onChange: (value: T[]) => void
  className?: string
}) {
  const toggle = (option: T) =>
    onChange(value.includes(option) ? value.filter((v) => v !== option) : [...value, option])

  return (
    <div role="group" aria-label={label} className={cn('flex flex-wrap items-center gap-1.5', className)}>
      <span className="mr-1 text-xs text-muted-foreground" aria-hidden="true">
        {label}
      </span>
      {options.map((option) => {
        const selected = value.includes(option.value)
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            onClick={() => toggle(option.value)}
            className={cn(
              'inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors',
              'focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none',
              selected
                ? 'border-primary/50 bg-primary/10 text-foreground'
                : 'bg-background/40 text-muted-foreground hover:border-border-strong hover:text-foreground',
            )}
          >
            {selected && <Check className="size-3 text-primary" aria-hidden="true" />}
            {option.dot && <span className={cn('size-2 rounded-full', option.dot)} aria-hidden="true" />}
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
