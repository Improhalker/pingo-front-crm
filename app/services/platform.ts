import type { ApiClient } from './http'
import type {
  ApiData,
  NewAdministratorInput,
  Paginated,
  PlatformListFilters,
  PlatformOrganization,
  PlatformOrganizationDetail,
  ProvisionOrganizationInput,
  SessionUser,
} from '../types/api'

// Platform administration contract (/api/v1/platform). Never sends X-Organization-Id.
export function platformService(api: ApiClient) {
  const base = '/api/v1/platform/organizations'
  const one = (id: string) => `${base}/${encodeURIComponent(id)}`
  return {
    login: (email: string, password: string) =>
      api<ApiData<SessionUser>>('/api/v1/platform/auth/login', {
        method: 'POST',
        body: { email, password },
      }),
    organizations: (
      page: number,
      signal: AbortSignal,
      filters: Partial<PlatformListFilters> = {},
    ) => {
      const query = new URLSearchParams({ page: String(page) })
      if (filters.search?.trim()) query.set('search', filters.search.trim())
      if (filters.status) query.set('status', filters.status)
      return api<Paginated<PlatformOrganization>>(`${base}?${query}`, {
        signal,
      })
    },
    provision: (input: ProvisionOrganizationInput, signal: AbortSignal) =>
      api<ApiData<PlatformOrganization>>(base, {
        method: 'POST',
        body: input,
        signal,
      }),
    show: (id: string, signal: AbortSignal) =>
      api<ApiData<PlatformOrganizationDetail>>(one(id), { signal }),
    update: (
      id: string,
      data: { name?: string; timezone?: string },
      signal: AbortSignal,
    ) =>
      api<ApiData<PlatformOrganizationDetail>>(one(id), {
        method: 'PATCH',
        body: data,
        signal,
      }),
    suspend: (id: string, signal: AbortSignal) =>
      api<ApiData<PlatformOrganizationDetail>>(`${one(id)}/suspend`, {
        method: 'POST',
        signal,
      }),
    reactivate: (id: string, signal: AbortSignal) =>
      api<ApiData<PlatformOrganizationDetail>>(`${one(id)}/reactivate`, {
        method: 'POST',
        signal,
      }),
    addAdministrator: (
      id: string,
      input: NewAdministratorInput,
      signal: AbortSignal,
    ) =>
      api<ApiData<PlatformOrganizationDetail>>(`${one(id)}/administrators`, {
        method: 'POST',
        body: input,
        signal,
      }),
    destroy: (id: string, confirmationName: string, signal: AbortSignal) =>
      api<ApiData<{ id: string; removed_accounts: number }>>(one(id), {
        method: 'DELETE',
        body: { confirmation_name: confirmationName },
        signal,
      }),
  }
}
