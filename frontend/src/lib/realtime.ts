import type { RealtimeEvent } from '@/types/api'

/**
 * Client for the authenticated WebSocket (WS /api/ws → FastAPI /ws).
 *
 * Protocol: after the socket opens, the first message carries the JWT
 * ({type: "auth", token}) — the token never appears in the URL. The server
 * answers {type: "ready"} and then pushes events for the user's own devices.
 *
 * Reconnects use capped exponential backoff with jitter (1s → 30s). A 4401
 * close means the token was rejected or expired: no retry; the session ends.
 * Liveness: the server sends a heartbeat every 30s, so prolonged silence
 * means a dead connection and triggers a reconnect.
 */

export type RealtimeState = 'idle' | 'connecting' | 'live' | 'reconnecting' | 'offline' | 'stopped'

type EventListener = (event: RealtimeEvent) => void
type StateListener = (state: RealtimeState) => void

const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? '/api').replace(/\/$/, '')
const CLOSE_UNAUTHORIZED = 4401
const BASE_DELAY_MS = 1_000
const MAX_DELAY_MS = 30_000
const SILENCE_LIMIT_MS = 75_000 // > 2 server heartbeats

function socketUrl(): string {
  const base = API_BASE.startsWith('http') ? new URL(API_BASE) : new URL(API_BASE, window.location.origin)
  base.protocol = base.protocol === 'https:' ? 'wss:' : 'ws:'
  base.pathname = `${base.pathname.replace(/\/$/, '')}/ws`
  return base.toString()
}

export class RealtimeClient {
  private socket: WebSocket | null = null
  private state: RealtimeState = 'idle'
  private attempt = 0
  private retryTimer: number | null = null
  private silenceTimer: number | null = null
  private readonly eventListeners = new Set<EventListener>()
  private readonly stateListeners = new Set<StateListener>()
  private readonly getToken: () => string | null
  private readonly onAuthRejected: () => void

  constructor(getToken: () => string | null, onAuthRejected: () => void) {
    this.getToken = getToken
    this.onAuthRejected = onAuthRejected
  }

  // ---------------------------------------------------------------- public

  start(): void {
    window.addEventListener('online', this.handleOnline)
    window.addEventListener('offline', this.handleOffline)
    document.addEventListener('visibilitychange', this.handleVisibility)
    this.connect()
  }

  stop(): void {
    window.removeEventListener('online', this.handleOnline)
    window.removeEventListener('offline', this.handleOffline)
    document.removeEventListener('visibilitychange', this.handleVisibility)
    this.clearTimers()
    this.setState('stopped')
    this.closeSocket()
  }

  /** Reconnect now (e.g. a user pressed "Reconnect"). */
  reconnectNow(): void {
    if (this.state === 'stopped') return
    this.attempt = 0
    this.clearTimers()
    this.closeSocket()
    this.connect()
  }

  getState(): RealtimeState {
    return this.state
  }

  onEvent(listener: EventListener): () => void {
    this.eventListeners.add(listener)
    return () => this.eventListeners.delete(listener)
  }

  onState(listener: StateListener): () => void {
    this.stateListeners.add(listener)
    return () => this.stateListeners.delete(listener)
  }

  // --------------------------------------------------------------- private

  private setState(next: RealtimeState): void {
    if (this.state === next) return
    this.state = next
    this.stateListeners.forEach((fn) => fn(next))
  }

  private connect(): void {
    if (this.state === 'stopped') return
    if (!navigator.onLine) {
      this.setState('offline')
      return
    }
    const token = this.getToken()
    if (!token) {
      this.stop()
      this.onAuthRejected()
      return
    }

    this.setState(this.attempt === 0 ? 'connecting' : 'reconnecting')
    const socket = new WebSocket(socketUrl())
    this.socket = socket

    socket.onopen = () => {
      socket.send(JSON.stringify({ type: 'auth', token }))
      this.armSilenceTimer()
    }

    socket.onmessage = (message) => {
      if (socket !== this.socket) return
      this.armSilenceTimer()
      let payload: { type?: string } & Record<string, unknown>
      try {
        payload = JSON.parse(String(message.data))
      } catch {
        return
      }
      if (payload.type === 'ready') {
        this.attempt = 0
        this.setState('live')
        return
      }
      if (payload.type === 'ping' || payload.type === 'pong') return
      this.eventListeners.forEach((fn) => fn(payload as unknown as RealtimeEvent))
    }

    socket.onclose = (event) => {
      if (socket !== this.socket) return
      this.socket = null
      this.clearSilenceTimer()
      if (this.state === 'stopped') return

      if (event.code === CLOSE_UNAUTHORIZED) {
        // Token rejected or expired: retrying with the same token cannot work.
        this.stop()
        this.onAuthRejected()
        return
      }
      this.scheduleReconnect()
    }

    // onerror is always followed by onclose; nothing to do here.
    socket.onerror = () => undefined
  }

  private scheduleReconnect(): void {
    if (this.state === 'stopped') return
    if (!navigator.onLine) {
      this.setState('offline')
      return
    }
    this.setState('reconnecting')
    const exponential = Math.min(MAX_DELAY_MS, BASE_DELAY_MS * 2 ** this.attempt)
    const delay = exponential / 2 + Math.random() * (exponential / 2) // jitter
    this.attempt += 1
    this.retryTimer = window.setTimeout(() => {
      this.retryTimer = null
      this.connect()
    }, delay)
  }

  private armSilenceTimer(): void {
    this.clearSilenceTimer()
    this.silenceTimer = window.setTimeout(() => {
      // No heartbeat for too long: treat the connection as dead.
      this.closeSocket()
      this.scheduleReconnect()
    }, SILENCE_LIMIT_MS)
  }

  private clearSilenceTimer(): void {
    if (this.silenceTimer !== null) window.clearTimeout(this.silenceTimer)
    this.silenceTimer = null
  }

  private clearTimers(): void {
    if (this.retryTimer !== null) window.clearTimeout(this.retryTimer)
    this.retryTimer = null
    this.clearSilenceTimer()
  }

  private closeSocket(): void {
    const socket = this.socket
    this.socket = null
    if (!socket) return
    socket.onmessage = null
    socket.onclose = null
    socket.onerror = null
    if (socket.readyState === WebSocket.CONNECTING) {
      // Aborting a socket mid-handshake makes browsers log a warning; let the
      // handshake finish and close it immediately instead.
      socket.onopen = () => socket.close(1000)
    } else if (socket.readyState === WebSocket.OPEN) {
      socket.onopen = null
      socket.close(1000)
    }
  }

  private readonly handleOnline = () => {
    if (this.state === 'offline' || this.state === 'reconnecting') this.reconnectNow()
  }

  private readonly handleOffline = () => {
    if (this.state === 'stopped') return
    this.clearTimers()
    this.closeSocket()
    this.setState('offline')
  }

  private readonly handleVisibility = () => {
    // Returning to the tab: don't wait out a long backoff.
    if (document.visibilityState === 'visible' && this.state === 'reconnecting') this.reconnectNow()
  }
}
