import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'

import { useServerWake } from '@/features/system/hooks'

/**
 * Global, non-blocking notice shown while the API is cold-starting.
 * Requests keep retrying underneath (see api-client); this only explains the wait.
 */
export function ServerWakeNotice() {
  const { waking, since } = useServerWake()
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!waking) return
    const timer = window.setInterval(() => setNow(Date.now()), 1_000)
    return () => window.clearInterval(timer)
  }, [waking])

  if (!waking) return null
  const elapsed = since ? Math.max(0, Math.round((now - since) / 1000)) : 0

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4">
      <div
        role="status"
        aria-live="polite"
        className="elevation-3 pointer-events-auto flex max-w-md items-start gap-3 rounded-xl border border-status-warning/40 bg-popover px-4 py-3 text-sm"
      >
        <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin text-status-warning" aria-hidden="true" />
        <div>
          <p className="font-medium">Waking up the server, this can take up to a minute</p>
          <p className="mt-0.5 flex justify-between gap-3 text-xs text-muted-foreground">
            <span>It sleeps when idle. Requests retry on their own.</span>
            <span className="font-mono tabular-nums">{elapsed}s</span>
          </p>
        </div>
      </div>
    </div>
  )
}
