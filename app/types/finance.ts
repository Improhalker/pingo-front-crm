// Company financial DTOs. Money is always a canonical decimal string ("1000.00"); sale/due dates are civil
// dates (YYYY-MM-DD) in the organization timezone; received_at is an ISO 8601 UTC instant.
export type CategoryType = 'REVENUE' | 'EXPENSE'
export type PaymentMethod =
  'CASH' | 'PIX' | 'BOLETO' | 'CARD' | 'TRANSFER' | 'OTHER'
export type ReceivableStatus = 'PENDING' | 'OVERDUE' | 'RECEIVED'
export type PayableStatus = 'PENDING' | 'OVERDUE' | 'PAID'
export type ArchiveFilter = 'active' | 'archived' | 'all'

export interface Customer {
  id: string
  name: string
  phone: string | null
  email: string | null
  document: string | null
  notes: string | null
  archived: boolean
  archived_at: string | null
  created_at: string
  updated_at: string
}
export interface CustomerInput {
  name: string
  phone: string | null
  email: string | null
  document: string | null
  notes: string | null
}

export interface Category {
  id: string
  name: string
  type: CategoryType
  archived: boolean
  archived_at: string | null
}

/** One obligation of a revenue/expense (card 10): the single due date or one line of a schedule. */
export interface Installment {
  id: string
  sequence: number
  is_down_payment: boolean
  amount: string
  settled_amount: string
  remaining_amount: string
  due_date: string
  reminder_date: string | null
  expected_method: PaymentMethod
  status: ReceivableStatus | PayableStatus
}
export interface Receipt {
  id: string
  amount: string
  method: PaymentMethod
  received_at: string
  created_by: string | null
  /** Card 09: EFFECTIVE rows count; CORRECTED rows are kept as evidence of a correction. */
  status: 'EFFECTIVE' | 'CORRECTED'
  installment_id: string
  installment_sequence: number | null
  registered_at: string | null
  corrects_id: string | null
  correction_reason: string | null
  superseded_at: string | null
  replaced_by_id: string | null
}
export interface Revenue {
  id: string
  version: number
  description: string
  customer: { id: string; name: string; archived: boolean }
  category: { id: string; name: string; archived: boolean }
  total_amount: string
  sale_date: string
  notes: string | null
  received_amount: string
  remaining_amount: string
  status: ReceivableStatus
  /** Next open instalment (or the last one when settled). */
  receivable: {
    id: string
    amount: string
    due_date: string
    expected_method: PaymentMethod
  }
  installments: Installment[]
  receipts?: Receipt[]
  created_at: string
}
export interface RevenueInput {
  customer_id: string
  category_id: string
  description: string
  total_amount: string
  sale_date: string
  /** Pending only: chosen freely, not before the sale. Omitted when settled at once. */
  due_date?: string
  expected_method?: PaymentMethod
  notes: string | null
  /** Explicit "already received in full" (card 06): the server derives the due date from received_at. */
  settlement?: { method: PaymentMethod; received_at: string }
  /** Pending single obligation only: internal reminder, independent of the due date (card 10). */
  reminder_date?: string | null
  /** Card 10: down payment and instalments; replaces due_date/expected_method/settlement. */
  installments?: ScheduleLineInput<'received_at'>[]
}
export interface ReceiptInput {
  amount: string
  method: PaymentMethod
  received_at: string
}

export interface Payment {
  id: string
  amount: string
  method: PaymentMethod
  paid_at: string
  created_by: string | null
  /** Card 09: EFFECTIVE rows count; CORRECTED rows are kept as evidence of a correction. */
  status: 'EFFECTIVE' | 'CORRECTED'
  installment_id: string
  installment_sequence: number | null
  registered_at: string | null
  corrects_id: string | null
  correction_reason: string | null
  superseded_at: string | null
  replaced_by_id: string | null
}
export interface Expense {
  id: string
  version: number
  description: string
  category: { id: string; name: string; archived: boolean }
  total_amount: string
  notes: string | null
  paid_amount: string
  remaining_amount: string
  status: PayableStatus
  /** Next open instalment (or the last one when settled). */
  payable: {
    id: string
    amount: string
    due_date: string
    expected_method: PaymentMethod
  }
  installments: Installment[]
  payments?: Payment[]
  created_at: string
}
export interface ExpenseInput {
  category_id: string
  description: string
  total_amount: string
  /** Pending only. Omitted when paid at once. */
  due_date?: string
  expected_method?: PaymentMethod
  notes: string | null
  /** Explicit "already paid in full" (card 06): the server derives the due date from paid_at. */
  settlement?: { method: PaymentMethod; paid_at: string }
  reminder_date?: string | null
  installments?: ScheduleLineInput<'paid_at'>[]
}
/** One line of a schedule. Only the first line may be the down payment, and only it may carry a settlement. */
export type ScheduleLineInput<T extends 'received_at' | 'paid_at'> = {
  amount: string
  down_payment?: boolean
} & (
  | {
      due_date: string
      expected_method: PaymentMethod
      reminder_date?: string | null
    }
  | { settlement: { method: PaymentMethod } & Record<T, string> }
)
export interface CorrectionInput {
  expected_version: number
  amount: string
  method: PaymentMethod
  reason: string
  received_at?: string
  paid_at?: string
}
export interface ReminderItem {
  kind: 'RECEIVABLE' | 'PAYABLE'
  entry_id: string
  installment_id: string
  sequence: number
  instalments_count: number
  /** Position among the instalments proper and their count (the down payment is not one of them). */
  number: number
  instalments_total: number
  is_down_payment: boolean
  description: string
  counterpart: string
  reminder_date: string
  due_date: string
  expected_method: PaymentMethod
  amount: string
  remaining_amount: string
  status: ReceivableStatus | PayableStatus
}
export interface Reminders {
  today: string
  upcoming_until: string
  due: { total: number; items: ReminderItem[] }
  upcoming: { total: number; items: ReminderItem[] }
}
export interface PaymentInput {
  amount: string
  method: PaymentMethod
  paid_at: string
}

export const paymentMethods: { value: PaymentMethod; label: string }[] = [
  { value: 'PIX', label: 'Pix' },
  { value: 'CASH', label: 'Dinheiro' },
  { value: 'CARD', label: 'Cartão' },
  { value: 'BOLETO', label: 'Boleto' },
  { value: 'TRANSFER', label: 'Transferência' },
  { value: 'OTHER', label: 'Outro' },
]
export function methodLabel(method: PaymentMethod) {
  return paymentMethods.find((item) => item.value === method)?.label ?? method
}

export type RevenueUpdateInput = Omit<
  RevenueInput,
  | 'settlement'
  | 'due_date'
  | 'expected_method'
  | 'reminder_date'
  | 'installments'
> & {
  due_date: string
  expected_method: PaymentMethod
  expected_version: number
}
export type ExpenseUpdateInput = Omit<
  ExpenseInput,
  | 'settlement'
  | 'due_date'
  | 'expected_method'
  | 'reminder_date'
  | 'installments'
> & {
  due_date: string
  expected_method: PaymentMethod
  expected_version: number
}
