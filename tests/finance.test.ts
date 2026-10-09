import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApiClient } from '../app/services/http'
import { financeService } from '../app/services/finance'
import { createIdempotentAttempt } from '../app/utils/idempotency'
import { createLatestRequest } from '../app/utils/latest-request'
import {
  formatMoney,
  formatMoneyInput,
  parseMoneyInput,
  toCents,
} from '../app/utils/money'
import {
  formatCivilDate,
  formatInstant,
  nowLocalIn,
  todayIn,
  zonedLocalToIso,
} from '../app/utils/org-time'
import { createTenantScope } from '../app/utils/tenant-scope'

afterEach(() => vi.unstubAllGlobals())

describe('money input', () => {
  it.each([
    ['1.000,50', '1000.50'],
    ['1000,5', '1000.50'],
    ['1000', '1000.00'],
    ['1.000', '1000.00'],
    ['R$ 400,00', '400.00'],
    ['0,01', '0.01'],
    ['999.999.999,99', '999999999.99'],
    ['12.5', '12.50'],
  ])('normalizes %s to %s without floating point', (input, expected) => {
    expect(parseMoneyInput(input)).toEqual({ ok: true, value: expected })
  })

  it.each([
    ['', 'Informe o valor.'],
    ['0', 'O valor precisa ser maior que zero.'],
    ['0,00', 'O valor precisa ser maior que zero.'],
    ['10,005', 'Use no máximo duas casas decimais.'],
    ['1.000.000.000,00', 'O valor máximo aceito é R$ 999.999.999,99.'],
    ['-5', 'Use apenas números, por exemplo 1.000,50.'],
    ['1e3', 'Use apenas números, por exemplo 1.000,50.'],
    ['1,000,00', 'Use um valor como 1.000,50.'],
    ['10.00,5', 'Use um valor como 1.000,50.'],
  ])('refuses %j instead of rounding', (input, error) => {
    expect(parseMoneyInput(input)).toEqual({ ok: false, error })
  })

  it('formats canonical strings exactly, including large values', () => {
    expect(formatMoney('1000.00')).toBe('R$ 1.000,00')
    expect(formatMoney('600.00')).toBe('R$ 600,00')
    expect(formatMoney('999999999.99')).toBe('R$ 999.999.999,99')
    expect(formatMoney('0.10')).toBe('R$ 0,10')
    expect(formatMoneyInput('1234.56')).toBe('1.234,56')
    expect(toCents('1000.00') - toCents('400.00')).toBe(60000n)
    expect(() => toCents('10.5')).toThrow()
  })
})

describe('organization time', () => {
  // 2026-10-07T01:30Z is still 2026-10-06 22:30 in São Paulo (UTC-03).
  const instant = new Date('2026-10-07T01:30:00Z')

  it('uses the organization calendar day, not the browser or UTC day', () => {
    expect(todayIn('America/Sao_Paulo', instant)).toBe('2026-10-06')
    expect(todayIn('UTC', instant)).toBe('2026-10-07')
    expect(nowLocalIn('America/Sao_Paulo', instant)).toBe('2026-10-06T22:30')
  })

  it('converts a wall time of the organization into the effective UTC instant', () => {
    expect(zonedLocalToIso('2026-10-06T22:30', 'America/Sao_Paulo')).toBe(
      '2026-10-07T01:30:00.000Z',
    )
    expect(zonedLocalToIso('2026-01-15T09:00', 'Europe/Lisbon')).toBe(
      '2026-01-15T09:00:00.000Z',
    )
    expect(zonedLocalToIso('2026-07-15T09:00', 'Europe/Lisbon')).toBe(
      '2026-07-15T08:00:00.000Z',
    )
    expect(() => zonedLocalToIso('2026-10-06', 'UTC')).toThrow()
  })

  it('shows civil dates as typed and instants in the organization timezone', () => {
    expect(formatCivilDate('2026-10-06')).toBe('06/10/2026')
    expect(
      formatInstant('2026-10-07T01:30:00.000+00:00', 'America/Sao_Paulo'),
    ).toBe('06/10/2026, 22:30')
  })
})

describe('idempotent attempts', () => {
  it('reuses the key for a retry of the same payload and renews it when the payload changes', () => {
    let next = 0
    const attempt = createIdempotentAttempt(() => `key-${++next}`)
    const payload = { amount: '400.00', method: 'PIX' }
    expect(attempt.keyFor(payload)).toBe('key-1')
    expect(attempt.keyFor({ ...payload })).toBe('key-1')
    expect(attempt.keyFor({ ...payload, amount: '700.00' })).toBe('key-2')
    attempt.reset()
    expect(attempt.keyFor({ ...payload, amount: '700.00' })).toBe('key-3')
  })

  it('creates keys accepted by the API', () => {
    expect(createIdempotentAttempt().keyFor({})).toMatch(
      /^[A-Za-z0-9_-]{16,100}$/,
    )
  })
})

describe('tenant scope', () => {
  it('aborts and invalidates every request of the closing organization', () => {
    const scope = createTenantScope()
    const first = scope.join()
    const second = scope.join()
    scope.reset()
    expect(first.signal.aborted).toBe(true)
    expect(second.isCurrent()).toBe(false)
    const next = scope.join()
    expect(next.signal.aborted).toBe(false)
    expect(next.isCurrent()).toBe(true)
  })

  it('combines with a page lane: a newer request also supersedes the older one', () => {
    const scope = createTenantScope()
    const lane = createLatestRequest()
    const older = scope.join(lane.begin())
    const newer = scope.join(lane.begin())
    expect(older.signal.aborted).toBe(true)
    expect(older.isCurrent()).toBe(false)
    expect(newer.isCurrent()).toBe(true)
    scope.reset()
    expect(newer.signal.aborted).toBe(true)
  })
})

describe('finance service contract', () => {
  const api = createApiClient('http://localhost:8000')
  function stubFetch(status: number, body: unknown) {
    vi.stubGlobal('document', { cookie: 'XSRF-TOKEN=abc%3D' })
    const stub = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify(body), { status }))
    vi.stubGlobal('fetch', stub)
    return stub
  }

  it('sends the organization, CSRF and Idempotency-Key on a receipt, with money as a string', async () => {
    const stub = stubFetch(201, { data: { id: '1' } })
    const input = {
      amount: '400.00',
      method: 'PIX' as const,
      received_at: '2026-10-06T13:00:00.000Z',
    }
    await financeService(api, '7').registerReceipt(
      '15',
      input,
      'attempt-0001-key',
    )
    const [url, init] = stub.mock.calls[0]!
    expect(url).toBe('http://localhost:8000/api/v1/receivables/15/receipts')
    expect(init).toMatchObject({ method: 'POST', credentials: 'include' })
    expect(init.headers).toMatchObject({
      'X-Organization-Id': '7',
      'Idempotency-Key': 'attempt-0001-key',
      'X-XSRF-TOKEN': 'abc=',
    })
    expect(init.body).toBe(JSON.stringify(input))
    expect(JSON.parse(init.body).amount).toBe('400.00')
  })

  it('reads lists with filters in the query string and no idempotency header', async () => {
    const stub = stubFetch(200, { data: [], meta: {} })
    const service = financeService(api, '7')
    await service.customers({ page: 2, search: 'Ana Maria', status: 'all' })
    await service.categories({ type: 'REVENUE', status: 'active', search: '' })
    await service.revenues({ status: 'overdue' })
    expect(stub.mock.calls.map((call) => call[0])).toEqual([
      'http://localhost:8000/api/v1/customers?page=2&search=Ana+Maria&status=all',
      'http://localhost:8000/api/v1/categories?type=REVENUE&status=active',
      'http://localhost:8000/api/v1/revenues?status=overdue',
    ])
    expect(stub.mock.calls[0]![1].headers).not.toHaveProperty('Idempotency-Key')
  })

  it('sends expense writes and payments with the company, CSRF, exact amounts and retry key', async () => {
    const stub = stubFetch(201, { data: { id: '2' } })
    const service = financeService(api, '7')
    const input = {
      category_id: '9',
      description: 'Combustível',
      total_amount: '300.00',
      due_date: '2026-10-06',
      expected_method: 'PIX' as const,
      notes: null,
    }
    const payment = {
      amount: '100.00',
      method: 'CASH' as const,
      paid_at: '2026-10-06T13:00:00.000Z',
    }
    const signal = new AbortController().signal
    await service.createExpense(input, 'expense-0001-key', signal)
    await service.registerPayment('22', payment, 'payment-0001-key', signal)
    expect(stub.mock.calls.map((call) => call[0])).toEqual([
      'http://localhost:8000/api/v1/expenses',
      'http://localhost:8000/api/v1/payables/22/payments',
    ])
    for (const [, init] of stub.mock.calls) {
      expect(init).toMatchObject({
        method: 'POST',
        credentials: 'include',
        signal,
      })
      expect(init.headers).toMatchObject({
        'X-Organization-Id': '7',
        'X-XSRF-TOKEN': 'abc=',
      })
    }
    expect(stub.mock.calls[0]![1].headers['Idempotency-Key']).toBe(
      'expense-0001-key',
    )
    expect(stub.mock.calls[1]![1].headers['Idempotency-Key']).toBe(
      'payment-0001-key',
    )
    expect(JSON.parse(stub.mock.calls[0]![1].body)).toEqual(input)
    expect(JSON.parse(stub.mock.calls[1]![1].body)).toEqual(payment)
  })

  it('reads expenses with an inclusive due period, pagination and situation in the tenant scope', async () => {
    const stub = stubFetch(200, { data: [], meta: {} })
    await financeService(api, '8').expenses({
      page: 2,
      status: 'overdue',
      due_from: '2026-10-01',
      due_to: '2026-10-31',
      search: 'pneus',
    })
    expect(stub.mock.calls[0]![0]).toBe(
      'http://localhost:8000/api/v1/expenses?page=2&status=overdue&due_from=2026-10-01&due_to=2026-10-31&search=pneus',
    )
    expect(stub.mock.calls[0]![1].headers).toMatchObject({
      'X-Organization-Id': '8',
    })
    expect(stub.mock.calls[0]![1].headers).not.toHaveProperty('Idempotency-Key')
  })

  it.each([403, 404, 409, 422])(
    'never treats HTTP %s as a registered revenue',
    async (status) => {
      stubFetch(status, { code: 'X', errors: {} })
      await expect(
        financeService(api, '7').createRevenue({} as never, 'attempt-0001-key'),
      ).rejects.toMatchObject({ status })
    },
  )

  it('sends financial corrections and deletion with version, CSRF, tenant, retry key and cancellation', async () => {
    const stub = stubFetch(200, { data: { id: '12' } })
    const service = financeService(api, '7')
    const signal = new AbortController().signal
    const expense = {
      category_id: '3',
      description: 'Corrigida',
      total_amount: '999999999.99',
      due_date: '2026-10-31',
      expected_method: 'PIX' as const,
      notes: null,
      expected_version: 4,
    }
    const revenue = { ...expense, customer_id: '9', sale_date: '2026-10-06' }
    await service.updateExpense('12', expense, 'update-expense-key', signal)
    await service.updateRevenue('13', revenue, 'update-revenue-key', signal)
    await service.deleteExpense('12', 5, 'delete-expense-key', signal)
    await service.deleteRevenue('13', 5, 'delete-revenue-key', signal)
    expect(stub.mock.calls.map((call) => [call[0], call[1].method])).toEqual([
      ['http://localhost:8000/api/v1/expenses/12', 'PATCH'],
      ['http://localhost:8000/api/v1/revenues/13', 'PATCH'],
      ['http://localhost:8000/api/v1/expenses/12', 'DELETE'],
      ['http://localhost:8000/api/v1/revenues/13', 'DELETE'],
    ])
    for (const [, init] of stub.mock.calls) {
      expect(init).toMatchObject({ credentials: 'include', signal })
      expect(init.headers).toMatchObject({
        'X-Organization-Id': '7',
        'X-XSRF-TOKEN': 'abc=',
      })
      expect(init.headers['Idempotency-Key']).toMatch(
        /^(update|delete)-(expense|revenue)-key$/,
      )
    }
    expect(JSON.parse(stub.mock.calls[0]![1].body)).toEqual(expense)
    expect(JSON.parse(stub.mock.calls[1]![1].body)).toEqual(revenue)
    expect(JSON.parse(stub.mock.calls[2]![1].body)).toEqual({
      expected_version: 5,
    })
    expect(JSON.parse(stub.mock.calls[3]![1].body)).toEqual({
      expected_version: 5,
    })
  })

  it.each([403, 404, 409, 422])(
    'does not report an edit or delete as successful after HTTP %s',
    async (status) => {
      stubFetch(status, {
        code: 'FINANCIAL_ENTRY_CHANGED',
        errors: { entry: ['Bloqueado'] },
      })
      const service = financeService(api, '7')
      await expect(
        service.updateRevenue('1', {} as never, 'update-revenue-key'),
      ).rejects.toMatchObject({ status })
      await expect(
        service.deleteExpense('2', 1, 'delete-expense-key'),
      ).rejects.toMatchObject({ status })
    },
  )
})
