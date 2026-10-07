import type { ApiErrorBody, Page, ValidationErrorItem } from '@/types/api'
import { clearSession, getToken } from '@/lib/auth-storage'

/**
 * All requests go to `/api/*`. In development the Vite proxy strips the
 * prefix and forwards to FastAPI (see vite.config.ts).
 */
const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? '/api').replace(/\/$/, '')

export class ApiError extends Error {
  readonly status: number
  /** Field → message, from FastAPI 422 validation errors. */
  readonly fieldErrors: Record<string, string>

  constructor(status: number, message: string, fieldErrors: Record<string, string> = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.fieldErrors = fieldErrors
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError
}

// --------------------------------------------------- unauthorized handling

type UnauthorizedHandler = () => void
let unauthorizedHandler: UnauthorizedHandler | null = null

/** AuthProvider registers this to redirect to /login when a session dies. */
export function setUnauthorizedHandler(handler: UnauthorizedHandler | null): void {
  unauthorizedHandler = handler
}

function handleUnauthorized(): void {
  clearSession()
  unauthorizedHandler?.()
}

// ----------------------------------------------------------- request core

type Body =
  | { json: unknown }
  | { form: Record<string, string> }

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: Body
  /** Attach the user JWT. Defaults to true. */
  auth?: boolean
  signal?: AbortSignal
}

function parseErrorBody(status: number, body: ApiErrorBody | null): ApiError {
  // Server errors: never surface server-provided text (could leak internals).
  if (status >= 500) return new ApiError(status, defaultMessage(status))

  const detail = body?.detail

  if (typeof detail === 'string') {
    return new ApiError(status, detail)
  }

  if (Array.isArray(detail)) {
    const fieldErrors: Record<string, string> = {}
    for (const item of detail as ValidationErrorItem[]) {
      // loc looks like ["body", "email"]; keep the last segment as field name.
      const field = String(item.loc[item.loc.length - 1] ?? '')
      if (field && !fieldErrors[field]) fieldErrors[field] = item.msg
    }
    const first = detail[0]?.msg ?? 'Validation failed'
    return new ApiError(status, first, fieldErrors)
  }

  return new ApiError(status, defaultMessage(status))
}

function defaultMessage(status: number): string {
  if (status === 0) return 'Cannot reach the EdgeSphere API. Check your connection or try again shortly.'
  if (status === 400) return 'The request was not valid.'
  if (status === 401) return 'Your session has expired. Please sign in again.'
  if (status === 403) return 'You do not have permission to perform this action.'
  if (status === 404) return 'The requested resource was not found.'
  if (status === 409) return 'This conflicts with the current state of the data.'
  if (status === 422) return 'Some of the submitted values are not valid.'
  if (status === 429) return 'Too many requests. Please wait a moment and try again.'
  if (status >= 500) return 'The server encountered an error. Please try again.'
  return `Request failed (${status})`
}

/** Append defined query parameters (arrays repeat the key) to a path. */
export function withQuery(
  path: string,
  params: Record<string, string | number | boolean | null | undefined | (string | number)[]>,
): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue
    if (Array.isArray(value)) value.forEach((v) => search.append(key, String(v)))
    else search.append(key, String(value))
  }
  const query = search.toString()
  return query ? `${path}?${query}` : path
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  return (await apiRequestWithResponse<T>(path, options)).data
}

/** GET a paginated list; the total comes from the X-Total-Count header. */
export async function apiRequestPage<T>(path: string, options: RequestOptions = {}): Promise<Page<T>> {
  const { data, headers } = await apiRequestWithResponse<T[]>(path, options)
  const total = Number(headers.get('X-Total-Count'))
  return { items: data, total: Number.isFinite(total) ? total : data.length }
}

async function apiRequestWithResponse<T>(
  path: string,
  options: RequestOptions = {},
): Promise<{ data: T; headers: Headers }> {
  const { method = 'GET', body, auth = true, signal } = options
  const headers = new Headers({ Accept: 'application/json' })

  if (auth) {
    const token = getToken()
    if (!token) {
      // Token missing or already expired: end the session without a round trip.
      handleUnauthorized()
      throw new ApiError(401, defaultMessage(401))
    }
    headers.set('Authorization', `Bearer ${token}`)
  }

  let payload: BodyInit | undefined
  if (body && 'json' in body) {
    headers.set('Content-Type', 'application/json')
    payload = JSON.stringify(body.json)
  } else if (body && 'form' in body) {
    headers.set('Content-Type', 'application/x-www-form-urlencoded')
    payload = new URLSearchParams(body.form).toString()
  }

  let response: Response
  try {
    response = await fetch(`${API_BASE}${path}`, { method, headers, body: payload, signal })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new ApiError(0, defaultMessage(0))
  }

  if (response.status === 401 && auth) {
    handleUnauthorized()
    throw new ApiError(401, defaultMessage(401))
  }

  // The Vite proxy answers 502/503/504 itself when FastAPI is down.
  if (!response.ok && [502, 503, 504].includes(response.status)) {
    const text = await response.text().catch(() => '')
    if (!text.trim().startsWith('{')) throw new ApiError(0, defaultMessage(0))
    throw parseErrorBody(response.status, safeJson(text))
  }

  if (response.status === 204) return { data: undefined as T, headers: response.headers }

  const text = await response.text()
  const data = text ? safeJson(text) : null

  if (!response.ok) throw parseErrorBody(response.status, data as ApiErrorBody | null)

  return { data: data as T, headers: response.headers }
}

function safeJson(text: string): ApiErrorBody | null {
  try {
    return JSON.parse(text) as ApiErrorBody
  } catch {
    return null
  }
}

/** Human-readable message for any thrown value. */
export function getErrorMessage(error: unknown): string {
  if (isApiError(error)) return error.message
  if (error instanceof Error) return error.message
  return 'Something went wrong.'
}
