import { describe, expect, it, vi, afterEach } from 'vitest'
import { createApiClient } from '../app/services/http'
import { platformService } from '../app/services/platform'
import { createLatestRequest } from '../app/utils/latest-request'
import { fieldMessage, PLATFORM_STATE_KEYS } from '../app/utils/platform-state'

afterEach(() => vi.unstubAllGlobals())

function stubFetch(status: number, body: unknown) {
  vi.stubGlobal('document', { cookie: 'XSRF-TOKEN=abc%3D' })
  const stub = vi
    .fn()
    .mockResolvedValue(new Response(JSON.stringify(body), { status }))
  vi.stubGlobal('fetch', stub)
  return stub
}

describe('platform service contract', () => {
  const api = createApiClient('http://localhost:8000')
  const controller = new AbortController()

  it('provisions through /api/v1/platform with CSRF, credentials and no organization header', async () => {
    const stub = stubFetch(201, { data: { id: '9' } })
    const input = {
      organization: { name: 'Empresa', timezone: 'America/Sao_Paulo' },
      administrator: {
        name: 'Pessoa',
        email: 'pessoa@example.test',
        password: 'senha-de-teste-123',
        password_confirmation: 'senha-de-teste-123',
      },
    }
    await platformService(api).provision(input, controller.signal)
    const [url, init] = stub.mock.calls[0]!
    expect(url).toBe('http://localhost:8000/api/v1/platform/organizations')
    expect(init).toMatchObject({ method: 'POST', credentials: 'include' })
    expect(init.headers['X-XSRF-TOKEN']).toBe('abc=')
    expect(init.headers).not.toHaveProperty('X-Organization-Id')
    expect(JSON.parse(init.body)).toEqual(input)
  })

  it('uses a dedicated platform login endpoint and a paginated list', async () => {
    const stub = stubFetch(200, { data: [], meta: {} })
    await platformService(api).login('a@example.test', 'x')
    await platformService(api).organizations(3, controller.signal)
    expect(stub.mock.calls[0]![0]).toBe(
      'http://localhost:8000/api/v1/platform/auth/login',
    )
    expect(stub.mock.calls[1]![0]).toBe(
      'http://localhost:8000/api/v1/platform/organizations?page=3',
    )
  })

  it.each([401, 403, 419, 422, 429])(
    'never treats HTTP %s as a successful provisioning',
    async (status) => {
      stubFetch(status, { code: 'X', errors: {} })
      await expect(
        platformService(api).provision({} as never, controller.signal),
      ).rejects.toMatchObject({ status })
    },
  )
})

describe('platform state lifetime', () => {
  it('drops responses that belong to a previous identity', () => {
    const requests = createLatestRequest()
    const first = requests.begin()
    requests.cancel() // logout or identity change
    expect(first.signal.aborted).toBe(true)
    expect(first.isCurrent()).toBe(false)
  })

  it('exposes every platform state key for clearing', () => {
    expect(PLATFORM_STATE_KEYS).toEqual(
      expect.arrayContaining(['platform.list', 'platform.created']),
    )
  })

  it('reads the first message of a field error', () => {
    const errors = { 'administrator.email': ['Este e-mail já está em uso.'] }
    expect(fieldMessage(errors, 'administrator.email')).toBe(
      'Este e-mail já está em uso.',
    )
    expect(fieldMessage(errors, 'administrator.name')).toBe('')
    expect(fieldMessage(undefined, 'x')).toBe('')
  })
})

describe('platform management contract', () => {
  const api = createApiClient('http://localhost:8000')
  const signal = new AbortController().signal

  it('sends search and status filters only when set', async () => {
    const stub = stubFetch(200, { data: [], meta: {} })
    await platformService(api).organizations(2, signal, {
      search: '  Alfa  ',
      status: 'suspended',
    })
    await platformService(api).organizations(1, signal, {
      search: ' ',
      status: '',
    })
    expect(stub.mock.calls[0]![0]).toBe(
      'http://localhost:8000/api/v1/platform/organizations?page=2&search=Alfa&status=suspended',
    )
    expect(stub.mock.calls[1]![0]).toBe(
      'http://localhost:8000/api/v1/platform/organizations?page=1',
    )
  })

  it('edits with PATCH and deletes with the typed confirmation, both with CSRF', async () => {
    const stub = stubFetch(200, { data: {} })
    const service = platformService(api)
    await service.update('7', { name: 'Novo nome' }, signal)
    await service.destroy('7', 'Novo nome', signal)
    await service.suspend('7', signal)
    const [updateUrl, updateInit] = stub.mock.calls[0]!
    expect(updateUrl).toBe(
      'http://localhost:8000/api/v1/platform/organizations/7',
    )
    expect(updateInit).toMatchObject({ method: 'PATCH' })
    expect(updateInit.headers['X-XSRF-TOKEN']).toBe('abc=')
    const [, deleteInit] = stub.mock.calls[1]!
    expect(deleteInit.method).toBe('DELETE')
    expect(deleteInit.headers['X-XSRF-TOKEN']).toBe('abc=')
    expect(JSON.parse(deleteInit.body)).toEqual({
      confirmation_name: 'Novo nome',
    })
    expect(stub.mock.calls[2]![0]).toBe(
      'http://localhost:8000/api/v1/platform/organizations/7/suspend',
    )
  })

  it('surfaces a 409 conflict on deletion as an error, never as success', async () => {
    stubFetch(409, {
      code: 'PLATFORM_ORGANIZATION_HAS_DATA',
      message: 'Esta empresa possui dados vinculados.',
    })
    await expect(
      platformService(api).destroy('7', 'X', signal),
    ).rejects.toMatchObject({
      status: 409,
      body: { code: 'PLATFORM_ORGANIZATION_HAS_DATA' },
    })
  })
})
