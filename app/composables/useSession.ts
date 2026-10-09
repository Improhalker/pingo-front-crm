import type { Organization, SessionUser } from '~/types/api'
import { ApiError } from '~/services/http'
import { sessionService } from '~/services/session'
import { platformService } from '~/services/platform'
import { isAccessDenial } from '~/utils/company-access'

export function useSession() {
  const user = useState<SessionUser | null>('session.user', () => null)
  const organization = useState<Organization | null>(
    'session.organization',
    () => null,
  )
  const loading = useState('session.contextLoading', () => false)
  const error = useState('session.error', () => '')
  // Why the account's company cannot be opened (no link, suspended, legacy multiple links), as told by the API.
  const accessIssue = useState<{ code: string; message: string } | null>(
    'session.accessIssue',
    () => null,
  )
  const app = useNuxtApp()
  const service = sessionService(app.$api)
  const platform = platformService(app.$api)
  function clearContext() {
    app.$contextRequests.cancel()
    // Company data requests of the closing context are aborted and their late responses ignored.
    app.$tenantRequests.reset()
    organization.value = null
    loading.value = false
    error.value = ''
    clearNuxtData()
    // The Pingo conversation belongs to the context that is closing: messages and draft go too.
    clearNuxtState(PINGO_STATE_KEYS, { reset: true })
    clearNuxtState(FINANCE_STATE_KEYS, { reset: true })
  }
  function clearSession() {
    clearContext()
    // Identity change: cancel pending platform requests and drop their data so late responses
    // cannot repopulate the previous session's state.
    app.$platformRequests.cancel()
    app.$platformMutations.cancel()
    clearNuxtState(PLATFORM_STATE_KEYS)
    accessIssue.value = null
    user.value = null
  }
  async function expireSession(path = '/login') {
    clearSession()
    await navigateTo(path)
  }
  async function ensureSession() {
    if (user.value) return true
    try {
      user.value = (await service.me()).data
      return true
    } catch (cause) {
      clearSession()
      if (!(cause instanceof ApiError && cause.status === 401))
        error.value = 'Não conseguimos verificar seu acesso. Tente novamente.'
      return false
    }
  }
  async function login(email: string, password: string) {
    clearSession()
    await service.csrf()
    user.value = (await service.login(email, password)).data
    return user.value
  }
  // Platform entrance: same Sanctum session, but only platform administrators are accepted.
  async function loginPlatform(email: string, password: string) {
    clearSession()
    await service.csrf()
    user.value = (await platform.login(email, password)).data
  }
  /**
   * Opens the account's single company (ADR-028): there is no selection step. Used at login, on reload
   * and on every company route. The server resolves and authorizes the context; the id sent is only the
   * one the server itself returned, and a mismatch is refused there.
   */
  async function ensureContext(): Promise<
    'ready' | 'platform' | 'blocked' | 'signed-out' | 'error' | 'cancelled'
  > {
    if (!(await ensureSession())) return 'signed-out'
    const current = user.value
    if (!current) return 'signed-out'
    if (current.is_platform_administrator) return 'platform'
    if (organization.value) return 'ready'
    const request = app.$contextRequests.begin()
    loading.value = true
    error.value = ''
    try {
      // Without an organization in the session the API explains why (no link, legacy links, suspended).
      const response = await service.context(
        current.access === 'ok' ? current.organization?.id : undefined,
        request.signal,
      )
      if (!request.isCurrent()) return 'cancelled'
      organization.value = response.data
      accessIssue.value = null
      return 'ready'
    } catch (cause) {
      if (!request.isCurrent()) return 'cancelled'
      if (cause instanceof ApiError) {
        if (cause.status === 401 || cause.status === 419) {
          clearSession()
          return 'signed-out'
        }
        if (isAccessDenial(cause)) {
          accessIssue.value = {
            code: cause.body.code ?? 'ORGANIZATION_NONE',
            message: cause.message,
          }
          return 'blocked'
        }
      }
      error.value = 'Não conseguimos abrir sua empresa agora. Tente novamente.'
      return 'error'
    } finally {
      if (request.isCurrent()) loading.value = false
    }
  }
  /** A company request was refused because the account lost access to its company while signed in. */
  async function blockAccess(cause: ApiError) {
    clearContext()
    accessIssue.value = {
      code: cause.body.code ?? 'ORGANIZATION_NONE',
      message: cause.message,
    }
    // Refresh what the session knows about the account; the page shows the server's reason.
    user.value = null
    await navigateTo('/acesso-indisponivel')
  }
  async function logout(redirectTo = '/login') {
    // Prevent pending tenant reads from restoring data, including while logout is in flight.
    clearContext()
    try {
      await service.logout()
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 419) {
        // Only retry logout after reinitializing CSRF. A failed logout is never presented as success.
        await service.csrf()
        await service.logout()
      } else if (!(cause instanceof ApiError && cause.status === 401)) {
        throw cause
      }
    }
    clearSession()
    await navigateTo(redirectTo)
  }
  return {
    user,
    organization,
    loading,
    error,
    accessIssue,
    ensureSession,
    ensureContext,
    blockAccess,
    login,
    loginPlatform,
    expireSession,
    logout,
  }
}
