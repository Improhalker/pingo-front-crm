// Instalment preview (card 10, ADR-032). Pure functions over money strings (BigInt cents) and civil dates;
// the server validates the final schedule again and never trusts this preview.
import type { PaymentMethod } from '../types/finance'
import { centsToString, toCents } from './money'

export interface PreviewLine {
  key: string
  amount: string
  down_payment: boolean
  due_date: string
  expected_method: PaymentMethod
  reminder_date: string
}

/** Splits a total into n parts of whole cents; leftover cents go to the last part (decided 08/10/2026). */
export function splitCents(total: string, parts: number): string[] {
  if (!Number.isInteger(parts) || parts < 1)
    throw new Error('At least one part')
  const cents = toCents(total)
  const base = cents / BigInt(parts)
  const result = Array.from({ length: parts }, () => centsToString(base))
  result[parts - 1] = centsToString(cents - base * BigInt(parts - 1))
  return result
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

/**
 * Civil date `months` after `start`, keeping its day. When that month is shorter the last day is used, and
 * the original day comes back in the following months: 31/01 → 28/02 → 31/03 → 30/04 (decided 08/10/2026).
 */
export function addMonthsKeepingDay(start: string, months: number): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(start)
  if (!match) throw new Error('Invalid civil date')
  const day = Number(match[3])
  const index = Number(match[1]) * 12 + (Number(match[2]) - 1) + months
  const year = Math.floor(index / 12)
  const month = (index % 12) + 1
  const clamped = Math.min(day, daysInMonth(year, month))
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(clamped).padStart(2, '0')}`
}

/** Civil date shifted by whole days (reminder before the due date). */
export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number]
  const shifted = new Date(Date.UTC(y, m - 1, d + days))
  return shifted.toISOString().slice(0, 10)
}

export interface PreviewOptions {
  total: string
  downPayment: string | null
  count: number
  firstDue: string
  method: PaymentMethod
  /** Days before each due date for the reminder; null leaves reminders empty. */
  reminderDaysBefore: number | null
  downPaymentDue: string
  downPaymentMethod: PaymentMethod
}

/** Down payment (optional) plus `count` monthly instalments splitting the rest exactly. */
export function buildPreview(options: PreviewOptions): PreviewLine[] {
  const total = toCents(options.total)
  const down = options.downPayment ? toCents(options.downPayment) : 0n
  if (down < 0n || down >= total)
    throw new Error('Down payment must be less than the total')
  const lines: PreviewLine[] = []
  if (down > 0n)
    lines.push({
      key: 'down',
      amount: centsToString(down),
      down_payment: true,
      due_date: options.downPaymentDue,
      expected_method: options.downPaymentMethod,
      reminder_date: '',
    })
  splitCents(centsToString(total - down), options.count).forEach(
    (amount, index) => {
      const due = addMonthsKeepingDay(options.firstDue, index)
      lines.push({
        key: `p${index + 1}`,
        amount,
        down_payment: false,
        due_date: due,
        expected_method: options.method,
        reminder_date:
          options.reminderDaysBefore === null
            ? ''
            : addDays(due, -options.reminderDaysBefore),
      })
    },
  )
  return lines
}

/** Difference between the total and the sum of the lines (zero when the schedule is exact). */
export function scheduleDifference(total: string, amounts: string[]): string {
  return centsToString(
    amounts.reduce((sum, amount) => sum - toCents(amount), toCents(total)),
  )
}
