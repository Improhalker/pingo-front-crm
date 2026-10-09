import { describe, expect, it, vi, afterEach } from 'vitest'
import { resolveTheme, validPreference } from '../app/design-core/theme'
import { createLatestRequest } from '../app/utils/latest-request'
import { createApiClient, ApiError } from '../app/services/http'

afterEach(() => vi.unstubAllGlobals())
describe('theme preference', () => {
  it('explicit preference wins, system follows OS and invalid values fall back', () => {
    expect(resolveTheme('light', true)).toBe('light')
    expect(resolveTheme('dark', false)).toBe('dark')
    expect(resolveTheme('system', true)).toBe('dark')
    expect(resolveTheme('system', false)).toBe('light')
    expect(validPreference('invalid')).toBe('system')
  })
})
describe('context lifetime', () => {
  it('cancels previous requests and rejects late responses on switch or logout', () => {
    const coordinator = createLatestRequest()
    const first = coordinator.begin()
    const second = coordinator.begin()
    expect(first.signal.aborted).toBe(true)
    expect(first.isCurrent()).toBe(false)
    expect(second.isCurrent()).toBe(true)
    coordinator.cancel()
    expect(second.signal.aborted).toBe(true)
    expect(second.isCurrent()).toBe(false)
  })
})
describe('HTTP contracts', () => {
  it('sends credentials, decoded CSRF and explicit organization and rejects HTTP errors', async () => {
    vi.stubGlobal('document', { cookie: 'XSRF-TOKEN=token%3D' })
    const fetchStub = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ code: 'FORBIDDEN', message: 'Acesso negado.' }),
          { status: 403 },
        ),
      )
    vi.stubGlobal('fetch', fetchStub)
    const api = createApiClient('http://localhost:8000')
    await expect(
      api('/api/v1/context', { method: 'POST', organizationId: '2', body: {} }),
    ).rejects.toBeInstanceOf(ApiError)
    expect(fetchStub.mock.calls[0]?.[1]).toMatchObject({
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        'X-XSRF-TOKEN': 'token=',
        'X-Organization-Id': '2',
      },
    })
  })
  it.each([401, 419, 422, 503])(
    'never returns HTTP %s as success',
    async (status) => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(new Response('{}', { status })),
      )
      await expect(
        createApiClient('http://localhost:8000')('/api/v1/health'),
      ).rejects.toMatchObject({ status })
    },
  )
})
