import { describe, expect, it, vi, afterEach } from 'vitest'
import { ApiError, createApiClient } from '../app/services/http'
import { sessionService } from '../app/services/session'
import { isAccessDenial } from '../app/utils/company-access'

afterEach(() => vi.unstubAllGlobals())

describe('single company context (ADR-028)', () => {
  it('opens the context without a selector, or with the id the server returned', async () => {
    const stub = vi
      .fn()
      .mockImplementation(
        async () =>
          new Response(JSON.stringify({ data: { id: '3' } }), { status: 200 }),
      )
    vi.stubGlobal('fetch', stub)
    const service = sessionService(createApiClient('http://localhost:8000'))
    const signal = new AbortController().signal
    await service.context(undefined, signal)
    await service.context('3', signal)
    expect(stub.mock.calls[0]![1].headers).not.toHaveProperty(
      'X-Organization-Id',
    )
    expect(stub.mock.calls[1]![1].headers['X-Organization-Id']).toBe('3')
  })

  it('tells account access denials apart from permission or resource errors', () => {
    const denial = (code: string, status = 403) =>
      new ApiError(status, { code, message: 'x' })
    expect(isAccessDenial(denial('ORGANIZATION_NONE'))).toBe(true)
    expect(isAccessDenial(denial('ORGANIZATION_AMBIGUOUS'))).toBe(true)
    expect(isAccessDenial(denial('ORGANIZATION_SUSPENDED'))).toBe(true)
    expect(isAccessDenial(denial('ORGANIZATION_ROLE_FORBIDDEN'))).toBe(false)
    expect(isAccessDenial(denial('PLATFORM_FORBIDDEN'))).toBe(false)
    expect(isAccessDenial(denial('NOT_FOUND', 404))).toBe(false)
  })
})
