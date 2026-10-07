import { apiRequest } from '@/lib/api-client'
import type { Token, UserRegister, UserResponse } from '@/types/api'

/** POST /auth/login — OAuth2 password form (username = email). */
export function loginRequest(email: string, password: string): Promise<Token> {
  return apiRequest<Token>('/auth/login', {
    method: 'POST',
    auth: false,
    body: { form: { username: email, password } },
  })
}

/** POST /auth/register → 201 UserResponse, 409 if the email exists. */
export function registerRequest(data: UserRegister): Promise<UserResponse> {
  return apiRequest<UserResponse>('/auth/register', {
    method: 'POST',
    auth: false,
    body: { json: data },
  })
}

/** GET /users/me */
export function fetchCurrentUser(signal?: AbortSignal): Promise<UserResponse> {
  return apiRequest<UserResponse>('/users/me', { signal })
}
