// Reports (card 11, ADR-033). Money as exact decimal strings; months YYYY-MM and dates YYYY-MM-DD in the
// company timezone; instants ISO 8601 UTC. Totals always cover the whole filtered set, never one page.
import type { PageMeta } from './api'
import type { PaymentMethod, PayableStatus, ReceivableStatus } from './finance'

/** CASH: the effective settlement instant. DUE_DATE: the instalment due date. */
export type ReportBasis = 'CASH' | 'DUE_DATE'

interface ReportHeader<Period> {
  period: Period & { timezone: string }
  basis: ReportBasis
  as_of: string
  today: string
  /** False when the company has no revenue or expense registered at all (not just in this period). */
  has_entries: boolean
}

export interface InstallmentPosition {
  sequence: number
  /** Position among the instalments proper; the down payment is not counted (0 for it). */
  number: number
  total: number
  is_down_payment: boolean
}

export interface MonthlyRow {
  month: string
  income: string
  expenses: string
  result: string
  /** Cash result minus the previous month's; null for the first month of the period. */
  result_change: string | null
  /** Revenue totals by sale date (not cash). */
  sold: string
  /** Expense instalments by due date (not cash). */
  expenses_due: string
}
export interface CategoryShare {
  id: string
  name: string
  archived: boolean
  amount: string
  movements: number
  /** Share of the period total in basis points (5714 = 57,14%). */
  share_bp: number
}
export interface MonthlyReport extends ReportHeader<{
  from: string
  to: string
  starts_on: string
  ends_on: string
}> {
  months: MonthlyRow[]
  totals: Omit<MonthlyRow, 'month' | 'result_change'>
  categories: { income: CategoryShare[]; expenses: CategoryShare[] }
}

export type StatementType = 'income' | 'expense'
export type StatementStatus = 'effective' | 'corrected' | 'all'
export interface StatementFilters {
  from: string
  to: string
  type: '' | StatementType
  category_id: string
  method: '' | PaymentMethod
  status: StatementStatus
  order: 'asc' | 'desc'
}
export interface StatementItem {
  kind: 'INCOME' | 'EXPENSE'
  id: string
  entry_id: string
  installment_id: string
  installment: InstallmentPosition
  description: string
  /** Customer of a revenue; null for expenses. */
  counterpart: string | null
  category: { id: string; name: string }
  method: PaymentMethod
  occurred_at: string
  local_date: string
  amount: string
  /** CORRECTED rows are listed for reference only and never enter the totals. */
  status: 'EFFECTIVE' | 'CORRECTED'
  is_correction: boolean
}
export interface StatementReport extends ReportHeader<{
  starts_on: string
  ends_on: string
}> {
  summary: {
    income: string
    expenses: string
    result: string
    effective_count: number
  }
  data: StatementItem[]
  meta: PageMeta
}

export type ForecastType = 'receivable' | 'payable'
export type ForecastStatus = 'pending' | 'overdue' | 'partial'
export interface ForecastFilters {
  due_from: string
  due_to: string
  type: '' | ForecastType
  status: '' | ForecastStatus
  category_id: string
  method: '' | PaymentMethod
}
export interface ForecastItem {
  kind: 'RECEIVABLE' | 'PAYABLE'
  id: string
  entry_id: string
  installment: InstallmentPosition
  description: string
  counterpart: string | null
  category: { id: string; name: string }
  due_date: string
  expected_method: PaymentMethod
  amount: string
  settled_amount: string
  remaining_amount: string
  status: ReceivableStatus | PayableStatus
}
export interface ForecastReport extends ReportHeader<{
  due_from: string | null
  due_to: string | null
}> {
  summary: {
    receivable: string
    payable: string
    difference: string
    overdue_receivable: string
    overdue_payable: string
  }
  data: ForecastItem[]
  meta: PageMeta
}
