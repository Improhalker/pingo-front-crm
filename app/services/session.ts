import type { ApiClient } from './http'
import type { ApiData, Organization, SessionUser } from '../types/api'

export function sessionService(api: ApiClient) {
  return {
    csrf: () => api<undefined>('/sanctum/csrf-cookie'),
    login: (email: string, password: string) =>
      api<ApiData<SessionUser>>('/api/v1/auth/login', {
        method: 'POST',
        body: { email, password },
      }),
    me: () => api<ApiData<SessionUser>>('/api/v1/auth/me'),
    logout: () =>
      api<ApiData<{ message: string }>>('/api/v1/auth/logout', {
        method: 'POST',
      }),
    // Without an id the server opens the account's single company; with one, it must match it.
    context: (id: string | undefined, signal: AbortSignal) =>
      api<ApiData<Organization>>('/api/v1/context', {
        organizationId: id,
        signal,
      }),
  }
}
