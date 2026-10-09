import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApiClient } from '../app/services/http'
import { financeService } from '../app/services/finance'
import {
  dashboardAxisLabel,
  dashboardMonthLabel,
  projectDashboardChart,
  shiftDashboardMonth,
} from '../app/utils/dashboard-chart'
import { createLatestRequest } from '../app/utils/latest-request'
import { createTenantScope } from '../app/utils/tenant-scope'

afterEach(() => vi.unstubAllGlobals())

describe('company dashboard', () => {
  it.each([403, 422, 503])(
    'keeps a failed HTTP %s dashboard request as an error instead of displaying zero balances',
    async (status) => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(
          new Response(JSON.stringify({ message: 'Falha controlada' }), {
            status,
          }),
        ),
      )
      await expect(
        financeService(createApiClient('http://localhost:8000'), '7').dashboard(
          '2026-10',
        ),
      ).rejects.toMatchObject({ status })
    },
  )

  it('uses the real tenant API, selected month, cookies and abort signal without a write key', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ data: { monthly: { income: '400.00' } } }),
        ),
      )
    vi.stubGlobal('fetch', fetch)
    const signal = new AbortController().signal
    const result = await financeService(
      createApiClient('http://localhost:8000'),
      '7',
    ).dashboard('2026-10', signal)
    const [url, init] = fetch.mock.calls[0]!
    expect(url).toBe('http://localhost:8000/api/v1/dashboard?month=2026-10')
    expect(init).toMatchObject({
      method: 'GET',
      credentials: 'include',
      signal,
    })
    expect(init.headers['X-Organization-Id']).toBe('7')
    expect(init.headers).not.toHaveProperty('Idempotency-Key')
    expect(result.data.monthly.income).toBe('400.00')
  })

  it('discards a response for an old month and for a company whose scope closed', async () => {
    const scope = createTenantScope()
    const lane = createLatestRequest()
    let complete!: (value: unknown) => void
    const response = new Promise((resolve) => {
      complete = resolve
    })
    const october = scope.join(lane.begin())
    let visible: unknown = null
    const pending = response.then((value) => {
      if (october.isCurrent()) visible = value
    })
    const november = scope.join(lane.begin())
    complete({ income: '400.00' })
    await pending
    expect(october.signal.aborted).toBe(true)
    expect(visible).toBeNull()
    scope.reset()
    expect(november.isCurrent()).toBe(false)
    expect(november.signal.aborted).toBe(true)
  })

  it('draws zero months without NaN and retains all daily exact values for the table', () => {
    const chart = projectDashboardChart([
      { date: '2026-10-01', income: '0.00', expenses: '0.00' },
    ])
    expect(chart.empty).toBe(true)
    expect(chart.points[0]).toMatchObject({
      x: 94,
      incomeY: 242,
      expensesY: 242,
      income: '0.00',
    })
    expect(chart.incomePath).not.toMatch(/NaN|Infinity/)
    expect(chart.ticks.at(-1)?.value).toBe('2.00')
  })

  it('keeps cent precision beyond Number safe integers and bounds graphic coordinates', () => {
    const chart = projectDashboardChart([
      { date: '2026-10-01', income: '900719925474099.99', expenses: '0.01' },
      { date: '2026-10-02', income: '0.00', expenses: '10.00' },
    ])
    expect(chart.points[0]!.income).toBe('900719925474099.99')
    expect(chart.points[0]!.expenses).toBe('0.01')
    for (const point of chart.points) {
      expect(point.incomeY).toBeGreaterThanOrEqual(32)
      expect(point.incomeY).toBeLessThanOrEqual(242)
      expect(point.expensesY).toBeGreaterThanOrEqual(32)
    }
    expect(chart.labels.map((point) => point.date)).toEqual([
      '2026-10-01',
      '2026-10-02',
    ])
    const compact = projectDashboardChart(
      [
        { date: '2026-10-01', income: '400.00', expenses: '100.00' },
        { date: '2026-10-31', income: '0.00', expenses: '0.00' },
      ],
      320,
    )
    expect(compact.points.map((point) => point.x)).toEqual([94, 288])
  })

  it('changes months across years using civil dates and labels the selected month', () => {
    expect(shiftDashboardMonth('2026-01', -1)).toBe('2025-12')
    expect(shiftDashboardMonth('2026-12', 1)).toBe('2027-01')
    expect(shiftDashboardMonth('2024-02', 1)).toBe('2024-03')
    expect(dashboardMonthLabel('2026-10')).toBe('outubro de 2026')
    expect(dashboardAxisLabel('0.01')).toBe('R$ 0,01')
    expect(dashboardAxisLabel('1500.00')).toBe('R$ 1,5 mil')
    expect(dashboardAxisLabel('1000000.00')).toBe('R$ 1 mi')
  })
})
