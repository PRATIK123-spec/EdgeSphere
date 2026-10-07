import { useApiHealth } from '@/features/system/hooks'
import { cn } from '@/lib/utils'

/** Reachability of the FastAPI backend, probed via GET /. */
export function ApiStatusIndicator() {
  const { isSuccess, isError, isPending } = useApiHealth()

  const label = isPending ? 'Checking API…' : isSuccess ? 'API connected' : 'API unreachable'
  const dot = isPending ? 'bg-muted-foreground' : isSuccess ? 'bg-status-online' : 'bg-status-critical'

  return (
    <div className="flex items-center gap-2.5 rounded-lg border bg-card/50 px-3 py-2" role="status">
      <span className="relative inline-flex size-2" aria-hidden="true">
        {isSuccess && <span className={cn('absolute inset-0 rounded-full animate-pulse-ring', dot)} />}
        <span className={cn('relative size-2 rounded-full', dot)} />
      </span>
      <div className="min-w-0 leading-tight">
        <div className="text-xs font-medium">{label}</div>
        <div className="truncate font-mono text-[10px] text-muted-foreground">
          {isError ? 'Start the FastAPI server' : 'FastAPI · /api'}
        </div>
      </div>
    </div>
  )
}
