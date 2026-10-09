import { ApiError } from '~/services/http'
import { isAccessDenial } from '~/utils/company-access'
import { financeService, type FinanceService } from '~/services/finance'
import type { RequestTicket } from '~/utils/tenant-scope'

// useState keys owned by the company financial screens; reset whenever the organization context closes.
export const FINANCE_STATE_KEYS = ['finance.notice']

/**
 * Company financial data of the open organization. Each call joins the tenant scope: when the organization
 * changes or the session ends, pending requests are aborted and their results discarded. Roles here only
 * shape the interface; Laravel Policies authorize every operation.
 */
export function useFinance() {
  const session = useSession()
  const app = useNuxtApp()
  const organization = session.organization
  const canManageCatalog = computed(() => organization.value?.role === 'ADMIN')
  const timezone = computed(() => organization.value?.timezone ?? 'UTC')
  // One-shot confirmation for the next screen, set only after the backend confirmed the write.
  const notice = useState<{ organizationId: string; text: string } | null>(
    'finance.notice',
    () => null,
  )

  async function run<T>(
    work: (service: FinanceService, signal: AbortSignal) => Promise<T>,
    lane?: RequestTicket,
  ): Promise<{ ok: true; value: T } | { ok: false }> {
    const id = organization.value?.id
    if (!id) return { ok: false }
    const ticket = app.$tenantRequests.join(lane)
    try {
      const value = await work(financeService(app.$api, id), ticket.signal)
      return ticket.isCurrent() ? { ok: true, value } : { ok: false }
    } catch (cause) {
      if (!ticket.isCurrent()) return { ok: false }
      if (
        cause instanceof ApiError &&
        (cause.status === 401 || cause.status === 419)
      ) {
        await session.expireSession('/login')
        return { ok: false }
      }
      // The account lost its company meanwhile (link revoked, legacy links, suspension): leave the screen.
      if (cause instanceof ApiError && isAccessDenial(cause)) {
        await session.blockAccess(cause)
        return { ok: false }
      }
      throw cause
    }
  }

  function setNotice(text: string) {
    if (organization.value)
      notice.value = { organizationId: organization.value.id, text }
  }
  function takeNotice() {
    const value = notice.value
    notice.value = null
    return value?.organizationId === organization.value?.id
      ? (value?.text ?? '')
      : ''
  }

  return {
    organization,
    canManageCatalog,
    timezone,
    run,
    setNotice,
    takeNotice,
  }
}

/** Public message for a failed company request; field errors stay next to their fields. */
export function financeErrorMessage(cause: unknown, fallback: string): string {
  if (cause instanceof ApiError) {
    if (cause.body.code === 'ORGANIZATION_ROLE_FORBIDDEN')
      return 'Seu papel nesta empresa não permite esta ação.'
    if (cause.body.code === 'ORGANIZATION_SUSPENDED') return cause.message
    if (cause.status === 404)
      return 'Registro não encontrado nesta empresa. Ele pode ter sido removido ou pertencer a outra empresa.'
    if (cause.status === 409 || cause.status === 429) return cause.message
    if (cause.status === 422) return 'Confira os campos indicados.'
  }
  return fallback
}
