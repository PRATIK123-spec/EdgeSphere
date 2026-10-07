import { RotateCw } from 'lucide-react'

import { useRealtime } from '@/features/realtime/realtime-context'
import type { RealtimeState } from '@/lib/realtime'
import { cn } from '@/lib/utils'

const LABELS: Record<RealtimeState, string> = {
  idle: 'Connecting',
  connecting: 'Connecting',
  live: 'Live',
  reconnecting: 'Reconnecting',
  offline: 'Offline',
  stopped: 'Disconnected',
}

/** Compact real-time connection state (shape + text, not colour alone). */
export function LiveIndicator({ className }: { className?: string }) {
  const { state, reconnect } = useRealtime()
  const live = state === 'live'
  const pending = state === 'connecting' || state === 'reconnecting' || state === 'idle'

  return (
    <button
      type="button"
      onClick={live ? undefined : reconnect}
      disabled={live}
      aria-live="polite"
      aria-label={live ? 'Real-time updates: live' : `Real-time updates: ${LABELS[state].toLowerCase()}. Click to reconnect.`}
      title={live ? 'Receiving real-time updates' : 'Click to reconnect now'}
      className={cn(
        'inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 font-mono text-[10px] font-semibold tracking-[0.14em] uppercase transition-colors',
        live ? 'cursor-default border-status-online/30 bg-status-online/10 text-foreground' : 'text-muted-foreground hover:text-foreground',
        className,
      )}
    >
      {pending ? (
        <RotateCw className="size-3 animate-spin" aria-hidden="true" />
      ) : (
        <span className="relative inline-flex size-2" aria-hidden="true">
          {live && <span className="absolute inset-0 animate-pulse-ring rounded-full bg-status-online" />}
          <span className={cn('relative size-2 rounded-full', live ? 'bg-status-online' : 'border border-muted-foreground')} />
        </span>
      )}
      {LABELS[state]}
    </button>
  )
}
