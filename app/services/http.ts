import type { PublicError } from '../types/api'

export class ApiError extends Error {
  constructor(
    public status: number,
    public body: PublicError,
  ) {
    super(body.message || 'Não foi possível concluir a solicitação.')
  }
}
export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  body?: unknown
  organizationId?: string
  /** Financial writes: same key for retries of the same operation and payload. */
  idempotencyKey?: string
  signal?: AbortSignal
}
export function xsrfToken(cookie: string): string | undefined {
  const entry = cookie
    .split('; ')
    .find((part) => part.startsWith('XSRF-TOKEN='))
  return entry
    ? decodeURIComponent(entry.slice('XSRF-TOKEN='.length))
    : undefined
}
export function createApiClient(baseUrl: string) {
  const base = baseUrl.replace(/\/$/, '')
  return async <T>(path: string, options: RequestOptions = {}): Promise<T> => {
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
    }
    if (options.body !== undefined) headers['Content-Type'] = 'application/json'
    if (options.organizationId)
      headers['X-Organization-Id'] = options.organizationId
    if (options.idempotencyKey)
      headers['Idempotency-Key'] = options.idempotencyKey
    if (options.method && options.method !== 'GET') {
      const token = xsrfToken(document.cookie)
      if (token) headers['X-XSRF-TOKEN'] = token
    }
    const response = await fetch(`${base}${path}`, {
      method: options.method || 'GET',
      headers,
      credentials: 'include',
      signal: options.signal,
      body:
        options.body === undefined ? undefined : JSON.stringify(options.body),
    })
    const body =
      response.status === 204
        ? undefined
        : await response.json().catch(() => ({}))
    if (!response.ok) throw new ApiError(response.status, body)
    return body as T
  }
}
export type ApiClient = ReturnType<typeof createApiClient>
