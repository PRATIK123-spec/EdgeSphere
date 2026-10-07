/**
 * Session persistence for the user JWT.
 *
 * The token lives in localStorage so a page reload keeps the session.
 * The backend issues no refresh token, so the session simply ends at the
 * token's `exp`. The token itself is never rendered anywhere in the UI.
 */

const STORAGE_KEY = 'edgesphere.session'

/** Treat a token as expired slightly early to avoid racing the server clock. */
const EXPIRY_SKEW_MS = 15_000

export interface StoredSession {
  token: string
  /** Epoch milliseconds, from the JWT `exp` claim. */
  expiresAt: number
}

type Listener = (session: StoredSession | null) => void
const listeners = new Set<Listener>()

function decodeJwtExpiry(token: string): number | null {
  const [, payload] = token.split('.')
  if (!payload) return null

  try {
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=')
    const claims = JSON.parse(atob(padded)) as { exp?: unknown }
    return typeof claims.exp === 'number' ? claims.exp * 1000 : null
  } catch {
    return null
  }
}

export function isSessionExpired(session: StoredSession, now = Date.now()): boolean {
  return now >= session.expiresAt - EXPIRY_SKEW_MS
}

function readRaw(): StoredSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<StoredSession>
    if (typeof parsed.token !== 'string' || typeof parsed.expiresAt !== 'number') {
      return null
    }
    return { token: parsed.token, expiresAt: parsed.expiresAt }
  } catch {
    return null
  }
}

/** Returns the stored session, or null if absent, malformed, or expired. */
export function getSession(): StoredSession | null {
  const session = readRaw()
  if (session && isSessionExpired(session)) {
    clearSession()
    return null
  }
  return session
}

export function getToken(): string | null {
  return getSession()?.token ?? null
}

/** Persist a freshly issued token. Returns null if the token has no usable `exp`. */
export function saveToken(token: string): StoredSession | null {
  const expiresAt = decodeJwtExpiry(token)
  if (expiresAt === null) return null

  const session: StoredSession = { token, expiresAt }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
  } catch {
    // Storage unavailable (private mode / quota): the session still works
    // for this tab through the listeners below, it just won't survive reload.
  }
  listeners.forEach((fn) => fn(session))
  return session
}

export function clearSession(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
  listeners.forEach((fn) => fn(null))
}

/** Subscribe to session changes in this tab and in other tabs. */
export function subscribeSession(listener: Listener): () => void {
  listeners.add(listener)

  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) listener(getSession())
  }
  window.addEventListener('storage', onStorage)

  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', onStorage)
  }
}
