/**
 * Tracks whether the API looks like it is cold-starting. The backend runs on
 * Render's free plan, which sleeps when idle; the first request after a
 * sleep is slow and can return 502/503/504 while the instance boots.
 *
 * api-client reports outcomes here; the UI subscribes via useServerWake().
 */

export interface ServerWakeState {
  waking: boolean
  /** Epoch ms when the current wake-up was first noticed. */
  since: number | null
}

/** Render sleeps after ~15 min idle; treat 10 min without a response as "may be asleep". */
const MAY_BE_ASLEEP_AFTER_MS = 10 * 60_000

let state: ServerWakeState = { waking: false, since: null }
let lastResponseAt = 0
const listeners = new Set<() => void>()

function setState(next: ServerWakeState): void {
  state = next
  for (const listener of listeners) listener()
}

/** A cold-start error was seen, or a request is unusually slow on a possibly sleeping server. */
export function markServerWaking(): void {
  // A browser with no network is not a sleeping server.
  if (typeof navigator !== 'undefined' && !navigator.onLine) return
  if (!state.waking) setState({ waking: true, since: Date.now() })
}

/** Any real response from the API (including 4xx) means it is up. */
export function markServerAwake(): void {
  lastResponseAt = Date.now()
  if (state.waking) setState({ waking: false, since: null })
}

export function serverMayBeAsleep(): boolean {
  return Date.now() - lastResponseAt > MAY_BE_ASLEEP_AFTER_MS
}

export function subscribeServerWake(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getServerWake(): ServerWakeState {
  return state
}
