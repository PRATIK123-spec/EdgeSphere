import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useApiHealth } from '@/features/system/hooks'
import { cn } from '@/lib/utils'

/**
 * Reachability of the FastAPI backend, probed via GET /.
 * `full` for the expanded sidebar, `dot` for the collapsed rail,
 * `pill` for the mobile topbar (where the sidebar lives in a drawer).
 */
export function ApiStatusIndicator({
  variant = 'full',
  className,
}: {
  variant?: 'full' | 'dot' | 'pill'
  className?: string
}) {
  const { isSuccess, isError, isPending } = useApiHealth()

  const label = isPending ? 'Checking API…' : isSuccess ? 'API connected' : 'API unreachable'
  const detail = isError ? 'Start the FastAPI server' : 'FastAPI · /api'
  const dot = isPending ? 'bg-muted-foreground' : isSuccess ? 'bg-status-online' : 'bg-status-critical'

  const indicator = (
    <span className="relative inline-flex size-2 shrink-0" aria-hidden="true">
      {isSuccess && <span className={cn('absolute inset-0 animate-pulse-ring rounded-full', dot)} />}
      <span className={cn('relative size-2 rounded-full', dot)} />
    </span>
  )

  if (variant === 'full') {
    return (
      <div
        className={cn('flex items-center gap-2.5 rounded-lg border bg-card/50 px-3 py-2', className)}
        role="status"
      >
        {indicator}
        <div className="min-w-0 leading-tight">
          <div className="text-xs font-medium">{label}</div>
          <div className="truncate font-mono text-[10px] text-muted-foreground">{detail}</div>
        </div>
      </div>
    )
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          role="status"
          tabIndex={0}
          aria-label={`${label}. ${detail}`}
          className={cn(
            'inline-flex items-center justify-center rounded-full border focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none',
            variant === 'dot' ? 'size-9 rounded-lg bg-card/50' : 'h-7 gap-1.5 px-2.5',
            isError && 'border-status-critical/40 bg-status-critical/10',
            className,
          )}
        >
          {indicator}
          {variant === 'pill' && (
            <span className="font-mono text-[10px] font-semibold tracking-[0.14em] uppercase">API</span>
          )}
        </span>
      </TooltipTrigger>
      <TooltipContent side={variant === 'dot' ? 'right' : 'bottom'} sideOffset={8}>
        {label} · {detail}
      </TooltipContent>
    </Tooltip>
  )
}
