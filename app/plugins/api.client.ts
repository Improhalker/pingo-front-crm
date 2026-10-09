import { createApiClient } from '~/services/http'
import { createLatestRequest } from '~/utils/latest-request'
import { createTenantScope } from '~/utils/tenant-scope'
export default defineNuxtPlugin(() => ({
  provide: {
    api: createApiClient(useRuntimeConfig().public.apiBase),
    contextRequests: createLatestRequest(),
    tenantRequests: createTenantScope(),
    platformRequests: createLatestRequest(),
    platformMutations: createLatestRequest(),
  },
}))
