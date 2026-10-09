// Presentation helpers of the reports (card 11). Amounts are computed by the backend; these only format
// and compare exact strings (BigInt cents), never floats.
import type { InstallmentPosition } from '../types/reports'
import { centsToString, formatMoney, toCents } from './money'

export const STATEMENT_MAX_DAYS = 366
export const MONTHLY_MAX_MONTHS = 12

export type ReportTone = 'positive' | 'negative' | 'zero'

export function reportToneOf(value: string): ReportTone {
  const cents = toCents(value)
  return cents > 0n ? 'positive' : cents < 0n ? 'negative' : 'zero'
}

/** Result always written out; color and arrow only reinforce it (card 08). */
export function reportResultLabel(value: string): string {
  const tone = reportToneOf(value)
  return tone === 'positive'
    ? 'Positivo'
    : tone === 'negative'
      ? 'Negativo'
      : 'Zerado'
}

/** "R$ 220,00 a mais que o mês anterior"; null when there is no previous month in the period. */
export function reportChangeLabel(change: string | null): string {
  if (change === null) return 'Primeiro mês do período'
  const cents = toCents(change)
  if (cents === 0n) return 'Igual ao mês anterior'
  const amount = formatMoney(centsToString(cents < 0n ? -cents : cents))
  return cents > 0n
    ? `${amount} a mais que o mês anterior`
    : `${amount} a menos que o mês anterior`
}

/** Basis points to a Portuguese percentage with two decimals: 5714 → "57,14%". */
export function reportShareLabel(basisPoints: number): string {
  const whole = Math.trunc(basisPoints / 100)
  const decimals = String(basisPoints % 100).padStart(2, '0')
  return `${whole},${decimals}%`
}

export function reportInstallmentLabel(position: InstallmentPosition): string {
  if (position.is_down_payment) return 'Entrada'
  return position.total > 1
    ? `Parcela ${position.number} de ${position.total}`
    : 'Parcela única'
}

function dayNumber(date: string): number {
  const [year, month, day] = date.split('-').map(Number)
  return Date.UTC(year!, month! - 1, day!) / 86_400_000
}

/** Message for an invalid civil period, or '' when it is acceptable. Both bounds optional. */
export function reportPeriodError(
  from: string,
  to: string,
  maxDays = STATEMENT_MAX_DAYS,
): string {
  if (!from || !to) return ''
  if (from > to) return 'O fim do período não pode ser anterior ao início.'
  if (dayNumber(to) - dayNumber(from) + 1 > maxDays)
    return `Escolha um período de até ${maxDays} dias.`
  return ''
}

/** Inclusive number of months between two YYYY-MM values. */
export function reportMonthSpan(from: string, to: string): number {
  const [fy, fm] = from.split('-').map(Number)
  const [ty, tm] = to.split('-').map(Number)
  return (ty! - fy!) * 12 + (tm! - fm!) + 1
}

export function reportMonthRangeError(from: string, to: string): string {
  if (!/^\d{4}-\d{2}$/.test(from) || !/^\d{4}-\d{2}$/.test(to))
    return 'Informe o mês inicial e o final.'
  if (from > to) return 'O mês final não pode ser anterior ao inicial.'
  if (reportMonthSpan(from, to) > MONTHLY_MAX_MONTHS)
    return `Escolha até ${MONTHLY_MAX_MONTHS} meses.`
  return ''
}

/** YYYY-MM shifted by whole months. */
export function reportShiftMonth(month: string, offset: number): string {
  const [year, value] = month.split('-').map(Number)
  const index = year! * 12 + (value! - 1) + offset
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`
}

/** First and last civil day of a YYYY-MM month. */
export function reportMonthBounds(month: string): { from: string; to: string } {
  const [year, value] = month.split('-').map(Number)
  const last = new Date(Date.UTC(year!, value!, 0)).getUTCDate()
  return {
    from: `${month}-01`,
    to: `${month}-${String(last).padStart(2, '0')}`,
  }
}

/** Link to the authorized entry, preselecting the instalment when given. */
export function reportEntryLink(
  revenue: boolean,
  entryId: string,
  installmentId?: string,
): string {
  const base = `${revenue ? '/receitas' : '/despesas'}/${encodeURIComponent(entryId)}`
  return installmentId
    ? `${base}?parcela=${encodeURIComponent(installmentId)}`
    : base
}
