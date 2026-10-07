import { createContext, useContext } from 'react'
import type { UserResponse } from '@/types/api'
import type { RegisterValues } from '@/features/auth/schemas'

export type AuthStatus = 'loading' | 'authenticated' | 'anonymous' | 'error'

export interface AuthContextValue {
  status: AuthStatus
  user: UserResponse | null
  /** Set when the session exists but /users/me failed for a non-auth reason. */
  error: unknown
  login: (email: string, password: string) => Promise<UserResponse>
  register: (values: RegisterValues) => Promise<UserResponse>
  logout: () => void
  /** End the session because the server rejected it (e.g. expired token on the WebSocket). */
  expireSession: () => void
  retry: () => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside <AuthProvider>')
  return value
}

export const meQueryKey = ['auth', 'me'] as const
