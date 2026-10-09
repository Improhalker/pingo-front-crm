import type { AgentChangeLog } from '#shared/utils/agent-changes'
import { ApiError, createApiClient } from '~/services/http'

export function useAgentChanges() {
  const log = useState<AgentChangeLog | null>(
    'platform.agentChanges',
    () => null,
  )
  const loading = useState('platform.agentChangesLoading', () => false)
  const error = useState('platform.agentChangesError', () => '')
  const app = useNuxtApp()
  const session = useSession()
  const api = createApiClient('')
  let cancel: (() => void) | undefined

  async function load() {
    const request = app.$platformRequests.begin()
    cancel = () => {
      if (!request.isCurrent()) return
      app.$platformRequests.cancel()
      loading.value = false
    }
    loading.value = true
    error.value = ''
    log.value = null
    try {
      const response = await api<AgentChangeLog>(
        '/api/platform/agent-changes',
        { signal: request.signal },
      )
      if (request.isCurrent()) log.value = response
    } catch (cause) {
      if (!request.isCurrent()) return
      if (
        cause instanceof ApiError &&
        (cause.status === 401 || cause.status === 419)
      ) {
        await session.expireSession('/plataforma/login')
      } else if (cause instanceof ApiError && cause.status === 403) {
        await navigateTo('/plataforma/acesso-negado')
      } else
        error.value = 'Não foi possível carregar o histórico. Tente novamente.'
    } finally {
      if (request.isCurrent()) loading.value = false
    }
  }
  onScopeDispose(() => cancel?.())
  return { log, loading, error, load }
}
