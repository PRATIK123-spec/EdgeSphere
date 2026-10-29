import { cn } from '@/lib/utils'

/** Compact toggle-button group for mutually exclusive view options. */
export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  label,
  className,
}: {
  value: T
  onChange: (value: T) => void
  options: { value: T; label: string }[]
  label: string
  className?: string
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn('inline-flex rounded-lg border bg-muted/40 p-0.5', className)}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            'min-h-8 flex-1 rounded-md px-3 py-1 text-xs font-medium transition-colors sm:flex-none',
            'focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none',
            value === option.value
              ? 'elevation-1 bg-background text-foreground'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
