import type {
  NewAdministratorInput,
  PageMeta,
  PlatformListFilters,
  PlatformOrganization,
  PlatformOrganizationDetail,
  ProvisionOrganizationInput,
} from '~/types/api'
import { ApiError } from '~/services/http'
import { platformService } from '~/services/platform'

// State of the platform area. Lives in Nuxt useState, is cancelled/cleared by useSession on any
// identity change, and ignores responses that belong to an older generation of requests.
export function usePlatform() {
  const organizations = useState<PlatformOrganization[]>(
    'platform.list',
    () => [],
  )
  const meta = useState<PageMeta | null>('platform.meta', () => null)
  const filters = useState<PlatformListFilters>('platform.filters', () => ({
    search: '',
    status: '',
  }))
  const loading = useState('platform.loading', () => false)
  const error = useState('platform.error', () => '')
  const created = useState<PlatformOrganization | null>(
    'platform.created',
    () => null,
  )
  // One-shot confirmation shown after a backend-confirmed change (e.g. a deletion).
  const notice = useState('platform.notice', () => '')
  const detail = useState<PlatformOrganizationDetail | null>(
    'platform.detail',
    () => null,
  )
  const detailLoading = useState('platform.detailLoading', () => false)
  const detailError = useState('platform.detailError', () => '')
  const app = useNuxtApp()
  const session = useSession()
  const service = platformService(app.$api)

  // Returns true when the failure was an authentication/authorization one and was already handled.
  async function handleAccessFailure(cause: unknown) {
    if (!(cause instanceof ApiError)) return false
    if (cause.status === 401 || cause.status === 419) {
      await session.expireSession('/plataforma/login')
      return true
    }
    if (cause.status === 403 && cause.body.code === 'PLATFORM_FORBIDDEN') {
      await navigateTo('/plataforma/acesso-negado')
      return true
    }
    return false
  }

  async function load(page = 1) {
    const request = app.$platformRequests.begin()
    loading.value = true
    error.value = ''
    try {
      const response = await service.organizations(
        page,
        request.signal,
        filters.value,
      )
      if (!request.isCurrent()) return
      organizations.value = response.data
      meta.value = response.meta
    } catch (cause) {
      if (!request.isCurrent()) return
      if (await handleAccessFailure(cause)) return
      error.value = 'Não foi possível carregar as empresas. Tente novamente.'
    } finally {
      if (request.isCurrent()) loading.value = false
    }
  }

  async function loadDetail(id: string) {
    const request = app.$platformRequests.begin()
    detailLoading.value = true
    detailError.value = ''
    if (detail.value?.id !== id) detail.value = null
    try {
      const response = await service.show(id, request.signal)
      if (request.isCurrent()) detail.value = response.data
    } catch (cause) {
      if (!request.isCurrent()) return
      if (await handleAccessFailure(cause)) return
      detail.value = null
      detailError.value =
        cause instanceof ApiError && cause.status === 404
          ? 'Esta empresa não existe mais ou o endereço está incorreto.'
          : 'Não foi possível carregar a empresa. Tente novamente.'
    } finally {
      if (request.isCurrent()) detailLoading.value = false
    }
  }

  /**
   * Runs a write. State changes only after the backend confirms and only if the session identity has
   * not changed meanwhile. Business errors (409/422/429) are rethrown for the caller to display.
   */
  async function mutate<T>(
    run: (signal: AbortSignal) => Promise<T>,
  ): Promise<{ ok: true; value: T } | { ok: false }> {
    const request = app.$platformMutations.begin()
    try {
      const value = await run(request.signal)
      if (!request.isCurrent()) return { ok: false }
      return { ok: true, value }
    } catch (cause) {
      if (!request.isCurrent()) return { ok: false }
      if (await handleAccessFailure(cause)) return { ok: false }
      throw cause
    }
  }

  async function provision(input: ProvisionOrganizationInput) {
    created.value = null
    notice.value = ''
    const result = await mutate((signal) => service.provision(input, signal))
    if (result.ok) created.value = result.value.data
    return result.ok
  }

  async function updateOrganization(
    id: string,
    data: { name?: string; timezone?: string },
  ) {
    const result = await mutate((signal) => service.update(id, data, signal))
    if (result.ok) detail.value = result.value.data
    return result.ok
  }

  async function setSuspended(id: string, suspended: boolean) {
    const result = await mutate((signal) =>
      suspended ? service.suspend(id, signal) : service.reactivate(id, signal),
    )
    if (result.ok) detail.value = result.value.data
    return result.ok
  }

  async function addAdministrator(id: string, input: NewAdministratorInput) {
    const result = await mutate((signal) =>
      service.addAdministrator(id, input, signal),
    )
    if (result.ok) detail.value = result.value.data
    return result.ok
  }

  async function deleteOrganization(id: string, confirmationName: string) {
    const name = detail.value?.name ?? 'A empresa'
    const result = await mutate((signal) =>
      service.destroy(id, confirmationName, signal),
    )
    if (!result.ok) return false
    const removed = result.value.data.removed_accounts
    detail.value = null
    // A previous "created" confirmation must not outlive the company it describes.
    created.value = null
    notice.value =
      `${name} foi excluída.` +
      (removed === 1
        ? ' 1 conta que só acessava esta empresa também foi excluída.'
        : removed > 1
          ? ` ${removed} contas que só acessavam esta empresa também foram excluídas.`
          : '')
    return true
  }

  function dismissCreated() {
    created.value = null
  }
  function dismissNotice() {
    notice.value = ''
  }

  return {
    organizations,
    meta,
    filters,
    loading,
    error,
    created,
    notice,
    detail,
    detailLoading,
    detailError,
    load,
    loadDetail,
    provision,
    updateOrganization,
    setSuspended,
    addAdministrator,
    deleteOrganization,
    dismissCreated,
    dismissNotice,
  }
}
