/** Server-calculated company dashboard. Money is always an exact decimal string. */
export interface DashboardDay {
  date: string
  income: string
  expenses: string
}
export interface DashboardDueItem {
  kind: 'RECEIVABLE' | 'PAYABLE'
  source_id: string
  obligation_id: string
  description: string
  counterpart: string
  due_date: string
  remaining_amount: string
}
export interface DashboardDueList {
  total: number
  items: DashboardDueItem[]
}
export interface Dashboard {
  period: {
    month: string
    starts_on: string
    ends_on: string
    timezone: string
  }
  as_of: string
  today: string
  monthly: { income: string; expenses: string; result: string }
  outstanding: {
    receivable: string
    payable: string
    overdue_receivable: string
    overdue_payable: string
  }
  daily: DashboardDay[]
  due: {
    upcoming_until: string
    overdue: DashboardDueList
    upcoming: DashboardDueList
  }
}
