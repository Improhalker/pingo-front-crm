import type { ApiClient } from './http'
import type { ApiData, Paginated } from '../types/api'
import type { Dashboard } from '../types/dashboard'
import type {
  ForecastReport,
  MonthlyReport,
  StatementReport,
} from '../types/reports'
import type {
  ArchiveFilter,
  Category,
  CategoryType,
  CorrectionInput,
  Customer,
  CustomerInput,
  Expense,
  ExpenseInput,
  PaymentInput,
  ReceiptInput,
  Reminders,
  Revenue,
  RevenueInput,
  RevenueUpdateInput,
  ExpenseUpdateInput,
} from '../types/finance'

// Company data contract. Every call carries the selected organization; the backend authorizes it.
export function financeService(api: ApiClient, organizationId: string) {
  const query = (params: Record<string, string | number | undefined>) => {
    const search = new URLSearchParams()
    for (const [key, value] of Object.entries(params))
      if (value !== undefined && value !== '') search.set(key, String(value))
    return search.toString()
  }
  const id = (value: string) => encodeURIComponent(value)
  return {
    dashboard: (month: string, signal?: AbortSignal) =>
      api<ApiData<Dashboard>>(`/api/v1/dashboard?${query({ month })}`, {
        organizationId,
        signal,
      }),
    customers: (
      params: {
        page?: number
        search?: string
        status?: ArchiveFilter
        per_page?: number
      },
      signal?: AbortSignal,
    ) =>
      api<Paginated<Customer>>(`/api/v1/customers?${query(params)}`, {
        organizationId,
        signal,
      }),
    createCustomer: (input: CustomerInput, signal?: AbortSignal) =>
      api<ApiData<Customer>>('/api/v1/customers', {
        method: 'POST',
        body: input,
        organizationId,
        signal,
      }),
    updateCustomer: (
      customerId: string,
      input: CustomerInput,
      signal?: AbortSignal,
    ) =>
      api<ApiData<Customer>>(`/api/v1/customers/${id(customerId)}`, {
        method: 'PATCH',
        body: input,
        organizationId,
        signal,
      }),
    setCustomerArchived: (
      customerId: string,
      archived: boolean,
      signal?: AbortSignal,
    ) =>
      api<ApiData<Customer>>(
        `/api/v1/customers/${id(customerId)}/${archived ? 'archive' : 'unarchive'}`,
        { method: 'POST', organizationId, signal },
      ),
    categories: (
      params: {
        page?: number
        search?: string
        status?: ArchiveFilter
        type?: CategoryType
        per_page?: number
      },
      signal?: AbortSignal,
    ) =>
      api<Paginated<Category>>(`/api/v1/categories?${query(params)}`, {
        organizationId,
        signal,
      }),
    createCategory: (
      input: { name: string; type: CategoryType },
      signal?: AbortSignal,
    ) =>
      api<ApiData<Category>>('/api/v1/categories', {
        method: 'POST',
        body: input,
        organizationId,
        signal,
      }),
    renameCategory: (categoryId: string, name: string, signal?: AbortSignal) =>
      api<ApiData<Category>>(`/api/v1/categories/${id(categoryId)}`, {
        method: 'PATCH',
        body: { name },
        organizationId,
        signal,
      }),
    setCategoryArchived: (
      categoryId: string,
      archived: boolean,
      signal?: AbortSignal,
    ) =>
      api<ApiData<Category>>(
        `/api/v1/categories/${id(categoryId)}/${archived ? 'archive' : 'unarchive'}`,
        { method: 'POST', organizationId, signal },
      ),
    revenues: (
      params: {
        page?: number
        search?: string
        status?: 'pending' | 'overdue' | 'received'
      },
      signal?: AbortSignal,
    ) =>
      api<Paginated<Revenue>>(`/api/v1/revenues?${query(params)}`, {
        organizationId,
        signal,
      }),
    revenue: (revenueId: string, signal?: AbortSignal) =>
      api<ApiData<Revenue>>(`/api/v1/revenues/${id(revenueId)}`, {
        organizationId,
        signal,
      }),
    updateRevenue: (
      entryId: string,
      input: RevenueUpdateInput,
      idempotencyKey: string,
      signal?: AbortSignal,
    ) =>
      api<ApiData<Revenue>>(`/api/v1/revenues/${id(entryId)}`, {
        method: 'PATCH',
        body: input,
        organizationId,
        idempotencyKey,
        signal,
      }),
    deleteRevenue: (
      entryId: string,
      expectedVersion: number,
      idempotencyKey: string,
      signal?: AbortSignal,
    ) =>
      api<ApiData<{ id: string; deleted: boolean }>>(
        `/api/v1/revenues/${id(entryId)}`,
        {
          method: 'DELETE',
          body: { expected_version: expectedVersion },
          organizationId,
          idempotencyKey,
          signal,
        },
      ),
    createRevenue: (
      input: RevenueInput,
      idempotencyKey: string,
      signal?: AbortSignal,
    ) =>
      api<ApiData<Revenue>>('/api/v1/revenues', {
        method: 'POST',
        body: input,
        organizationId,
        idempotencyKey,
        signal,
      }),
    expenses: (
      params: {
        page?: number
        per_page?: number
        search?: string
        status?: 'pending' | 'overdue' | 'paid'
        due_from?: string
        due_to?: string
      },
      signal?: AbortSignal,
    ) =>
      api<Paginated<Expense>>(`/api/v1/expenses?${query(params)}`, {
        organizationId,
        signal,
      }),
    expense: (expenseId: string, signal?: AbortSignal) =>
      api<ApiData<Expense>>(`/api/v1/expenses/${id(expenseId)}`, {
        organizationId,
        signal,
      }),
    updateExpense: (
      entryId: string,
      input: ExpenseUpdateInput,
      idempotencyKey: string,
      signal?: AbortSignal,
    ) =>
      api<ApiData<Expense>>(`/api/v1/expenses/${id(entryId)}`, {
        method: 'PATCH',
        body: input,
        organizationId,
        idempotencyKey,
        signal,
      }),
    deleteExpense: (
      entryId: string,
      expectedVersion: number,
      idempotencyKey: string,
      signal?: AbortSignal,
    ) =>
      api<ApiData<{ id: string; deleted: boolean }>>(
        `/api/v1/expenses/${id(entryId)}`,
        {
          method: 'DELETE',
          body: { expected_version: expectedVersion },
          organizationId,
          idempotencyKey,
          signal,
        },
      ),
    createExpense: (
      input: ExpenseInput,
      idempotencyKey: string,
      signal?: AbortSignal,
    ) =>
      api<ApiData<Expense>>('/api/v1/expenses', {
        method: 'POST',
        body: input,
        organizationId,
        idempotencyKey,
        signal,
      }),
    correctPayment: (
      paymentId: string,
      input: CorrectionInput,
      idempotencyKey: string,
      signal?: AbortSignal,
    ) =>
      api<ApiData<Expense>>(`/api/v1/payments/${id(paymentId)}/corrections`, {
        method: 'POST',
        body: input,
        organizationId,
        idempotencyKey,
        signal,
      }),
    correctReceipt: (
      receiptId: string,
      input: CorrectionInput,
      idempotencyKey: string,
      signal?: AbortSignal,
    ) =>
      api<ApiData<Revenue>>(`/api/v1/receipts/${id(receiptId)}/corrections`, {
        method: 'POST',
        body: input,
        organizationId,
        idempotencyKey,
        signal,
      }),
    reminders: (signal?: AbortSignal) =>
      api<ApiData<Reminders>>('/api/v1/reminders', { organizationId, signal }),
    monthlyReport: (
      params: { from?: string; to?: string },
      signal?: AbortSignal,
    ) =>
      api<ApiData<MonthlyReport>>(`/api/v1/reports/monthly?${query(params)}`, {
        organizationId,
        signal,
      }),
    statementReport: (
      params: Record<string, string | number | undefined>,
      signal?: AbortSignal,
    ) =>
      api<StatementReport>(`/api/v1/reports/statement?${query(params)}`, {
        organizationId,
        signal,
      }),
    forecastReport: (
      params: Record<string, string | number | undefined>,
      signal?: AbortSignal,
    ) =>
      api<ForecastReport>(`/api/v1/reports/obligations?${query(params)}`, {
        organizationId,
        signal,
      }),
    registerPayment: (
      payableId: string,
      input: PaymentInput,
      idempotencyKey: string,
      signal?: AbortSignal,
    ) =>
      api<ApiData<Expense>>(`/api/v1/payables/${id(payableId)}/payments`, {
        method: 'POST',
        body: input,
        organizationId,
        idempotencyKey,
        signal,
      }),
    registerReceipt: (
      receivableId: string,
      input: ReceiptInput,
      idempotencyKey: string,
      signal?: AbortSignal,
    ) =>
      api<ApiData<Revenue>>(
        `/api/v1/receivables/${id(receivableId)}/receipts`,
        {
          method: 'POST',
          body: input,
          organizationId,
          idempotencyKey,
          signal,
        },
      ),
  }
}
export type FinanceService = ReturnType<typeof financeService>
