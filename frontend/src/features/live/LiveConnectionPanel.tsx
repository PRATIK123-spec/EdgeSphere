import { Loader2, Radio, RotateCw, WifiOff, type LucideIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { useRealtime } from '@/features/realtime/realtime-context'
import { LIVE_POLL_MS } from '@/features/telemetry/hooks'
import type { RealtimeState } from '@/lib/realtime'
import { cn } from '@/lib/utils'

const POLL_S = LIVE_POLL_MS / 1000

const COPY: Record<
  RealtimeState,
  { title: string; detail: string; transport: string; icon: LucideIcon; tone: 'live' | 'pending' | 'down'; canRetry: boolean }
> = {
  live: {
    title: 'Live',
    detail: 'Connected over WebSocket. Events arrive the moment a device reports.',
    transport: 'WebSocket',
    icon: Radio,
    tone: 'live',
    canRetry: false,
  },
  idle: {
    title: 'Connecting',
    detail: `Opening the real-time connection. Readings refresh every ${POLL_S}s until it is ready.`,
    transport: `Polling ${POLL_S}s`,
    icon: Loader2,
    tone: 'pending',
    canRetry: false,
  },
  connecting: {
    title: 'Connecting',
    detail: `Opening the real-time connection. Readings refresh every ${POLL_S}s until it is ready.`,
    transport: `Polling ${POLL_S}s`,
    icon: Loader2,
    tone: 'pending',
    canRetry: false,
  },
  reconnecting: {
    title: 'Reconnecting',
    detail: `The connection dropped. Retrying with backoff; readings refresh every ${POLL_S}s meanwhile.`,
    transport: `Polling ${POLL_S}s`,
    icon: Loader2,
    tone: 'pending',
    canRetry: true,
  },
  offline: {
    title: 'Offline',
    detail: 'Your browser has no network connection. Live updates resume when it returns.',
    transport: 'Paused',
    icon: WifiOff,
    tone: 'down',
    canRetry: false,
  },
  stopped: {
    title: 'Disconnected',
    detail: `Real-time updates stopped. Readings refresh every ${POLL_S}s; reconnect to get events again.`,
    transport: `Polling ${POLL_S}s`,
    icon: WifiOff,
    tone: 'down',
    canRetry: true,
  },
}

/** Always-visible real-time connection state for the live monitor (shape + text, never colour alone). */
export function LiveConnectionPanel() {
  const { state, reconnect } = useRealtime()
  const copy = COPY[state]
  const Icon = copy.icon

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'flex flex-wrap items-center gap-x-4 gap-y-3 rounded-xl border px-4 py-3',
        copy.tone === 'live' && 'border-status-online/30 bg-status-online/[0.06]',
        copy.tone === 'pending' && 'border-status-warning/40 bg-status-warning/[0.08]',
        copy.tone === 'down' && 'border-status-critical/40 bg-status-critical/[0.06]',
      )}
    >
      <span
        className={cn(
          'flex size-9 shrink-0 items-center justify-center rounded-lg border bg-card',
          copy.tone === 'live' && 'text-status-online',
          copy.tone === 'pending' && 'text-status-warning',
          copy.tone === 'down' && 'text-status-critical',
        )}
        aria-hidden="true"
      >
        {copy.tone === 'live' ? (
          <span className="relative inline-flex size-2.5">
            <span className="absolute inset-0 animate-pulse-ring rounded-full bg-status-online" />
            <span className="relative size-2.5 rounded-full bg-status-online" />
          </span>
        ) : (
          <Icon className={cn('size-4', Icon === Loader2 && 'animate-spin')} />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2 text-sm font-semibold">
          {copy.title}
          <span className="rounded-md border bg-card px-1.5 py-0.5 font-mono text-[10px] font-medium text-muted-foreground">
            {copy.transport}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">{copy.detail}</p>
      </div>
      {copy.canRetry && (
        <Button variant="outline" size="sm" onClick={reconnect}>
          <RotateCw aria-hidden="true" /> Reconnect now
        </Button>
      )}
    </div>
  )
}
