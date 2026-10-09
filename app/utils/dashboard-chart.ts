import type { DashboardDay } from '../types/dashboard'
import { centsToString, toCents } from './money'

export function dashboardMonthLabel(month: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${month}-15T12:00:00Z`))
}

export function shiftDashboardMonth(month: string, offset: number): string {
  const [year, part] = month.split('-').map(Number)
  const date = new Date(Date.UTC(year!, part! - 1 + offset, 15))
  return date.toISOString().slice(0, 7)
}

/** BigInt preserves financial values; Number is used only for bounded SVG pixel coordinates. */
export function projectDashboardChart(days: DashboardDay[], width = 760) {
  const cents = days.map((day) => ({
    income: toCents(day.income),
    expenses: toCents(day.expenses),
  }))
  const largest = cents.reduce(
    (max, day) =>
      [max, day.income, day.expenses].reduce((a, b) => (a > b ? a : b)),
    0n,
  )
  const target = (largest + 3n) / 4n || 25n
  let power = 1n
  while (power * 10n < target) power *= 10n
  const step = [1n, 2n, 5n, 10n].map((n) => n * power).find((n) => n >= target)!
  const ceiling = step * 4n
  const y = (value: bigint) =>
    242 - (Number((value * 1_000_000n) / ceiling) / 1_000_000) * 210
  const points = days.map((day, index) => ({
    date: day.date,
    x: 94 + (index / Math.max(1, days.length - 1)) * (width - 126),
    incomeY: y(cents[index]!.income),
    expensesY: y(cents[index]!.expenses),
    income: day.income,
    expenses: day.expenses,
  }))
  return {
    points,
    incomePath: points.map((p) => `${p.x},${p.incomeY}`).join(' '),
    expensesPath: points.map((p) => `${p.x},${p.expensesY}`).join(' '),
    ticks: Array.from({ length: 5 }, (_, i) => ({
      y: y(step * BigInt(i)),
      value: centsToString(step * BigInt(i)),
    })),
    labels: points.filter(
      (_, index) =>
        index === 0 || index === points.length - 1 || (index + 1) % 7 === 0,
    ),
    empty: largest === 0n,
  }
}

/** Abbreviations apply to axis labels only; cards and the data table always show the exact amount. */
export function dashboardAxisLabel(value: string): string {
  const cents = toCents(value)
  for (const [unit, suffix] of [
    [100_000_000_000n, 'bi'],
    [100_000_000n, 'mi'],
    [100_000n, 'mil'],
  ] as const) {
    if (cents >= unit) {
      const tenth = (cents * 10n) / unit
      return `R$ ${tenth / 10n}${tenth % 10n ? `,${tenth % 10n}` : ''} ${suffix}`
    }
  }
  return `R$ ${cents / 100n}${cents % 100n ? `,${(cents % 100n).toString().padStart(2, '0')}` : ''}`
}
