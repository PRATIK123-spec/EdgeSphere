import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useLocation, useNavigate } from 'react-router'
import { toast } from 'sonner'

import { ApiError, isApiError, setUnauthorizedHandler } from '@/lib/api-client'
import {
  clearSession,
  getSession,
  saveToken,
  subscribeSession,
  type StoredSession,
} from '@/lib/auth-storage'
import { fetchCurrentUser, loginRequest, registerRequest } from '@/features/auth/api'
import {
  AuthContext,
  meQueryKey,
  type AuthContextValue,
  type AuthStatus,
} from '@/features/auth/auth-context'
import type { RegisterValues } from '@/features/auth/schemas'
import type { UserResponse } from '@/types/api'

const EXPIRED_TOAST_ID = 'session-expired'

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const location = useLocation()

  const [session, setSession] = useState<StoredSession | null>(() => getSession())

  // Keep the latest location for redirect-back without re-registering handlers.
  const locationRef = useRef(location)
  useEffect(() => {
    locationRef.current = location
  }, [location])

  useEffect(() => subscribeSession(setSession), [])

  /** Session died underneath us (401 or expiry): wipe cached data and go to /login. */
  const endExpiredSession = useCallback(() => {
    clearSession()
    queryClient.clear()
    const from = locationRef.current
    if (from.pathname !== '/login' && from.pathname !== '/register') {
      toast.warning('Session expired', {
        id: EXPIRED_TOAST_ID,
        description: 'Please sign in again to continue.',
      })
      navigate('/login', { replace: true, state: { from } })
    }
  }, [navigate, queryClient])

  useEffect(() => {
    setUnauthorizedHandler(endExpiredSession)
    return () => setUnauthorizedHandler(null)
  }, [endExpiredSession])

  // Proactively end the session when the JWT expires (no refresh endpoint exists).
  useEffect(() => {
    if (!session) return
    const delay = session.expiresAt - Date.now() - 15_000
    const timer = window.setTimeout(endExpiredSession, Math.max(0, delay))
    return () => window.clearTimeout(timer)
  }, [session, endExpiredSession])

  const meQuery = useQuery({
    queryKey: meQueryKey,
    queryFn: ({ signal }) => fetchCurrentUser(signal),
    enabled: session !== null,
    staleTime: 5 * 60_000,
    retry: (count, error) => !(isApiError(error) && error.status < 500) && count < 2,
  })

  const login = useCallback(
    async (email: string, password: string): Promise<UserResponse> => {
      const token = await loginRequest(email, password)
      if (!saveToken(token.access_token)) {
        throw new ApiError(500, 'The server returned an unusable access token.')
      }
      // Shares the in-flight request with the meQuery that the new session enables.
      return queryClient.fetchQuery({
        queryKey: meQueryKey,
        queryFn: ({ signal }) => fetchCurrentUser(signal),
      })
    },
    [queryClient],
  )

  const register = useCallback(
    async (values: RegisterValues): Promise<UserResponse> => {
      await registerRequest({
        email: values.email,
        password: values.password,
        full_name: values.full_name.trim(),
      })
      return login(values.email, values.password)
    },
    [login],
  )

  const logout = useCallback(() => {
    clearSession()
    queryClient.clear()
    navigate('/login', { replace: true })
    toast.success('Signed out')
  }, [navigate, queryClient])

  const value = useMemo<AuthContextValue>(() => {
    let status: AuthStatus
    if (!session) status = 'anonymous'
    else if (meQuery.data) status = 'authenticated'
    else if (meQuery.isError) status = 'error'
    else status = 'loading'

    return {
      status,
      user: session ? (meQuery.data ?? null) : null,
      error: meQuery.error,
      login,
      register,
      logout,
      expireSession: endExpiredSession,
      retry: () => void meQuery.refetch(),
    }
  }, [session, meQuery, login, register, logout, endExpiredSession])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
