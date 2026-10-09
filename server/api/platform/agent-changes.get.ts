import source from '../../../data/agent-changes.json'
import { validateAgentChanges } from '../../../shared/utils/agent-changes'
import { checkMasterSession } from '../../utils/master-session'

export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'private, no-store')
  setHeader(event, 'Pragma', 'no-cache')
  setHeader(event, 'Vary', 'Cookie')
  const config = useRuntimeConfig()
  const access = await checkMasterSession(
    config.public.apiBase,
    getHeader(event, 'cookie'),
    getRequestURL(event).origin,
    async (url, options) => {
      const response = await fetch(url, {
        headers: options.headers,
        redirect: options.redirect,
        signal: AbortSignal.timeout(options.timeout),
      })
      if (!response.ok)
        throw Object.assign(new Error('Session verification failed'), {
          statusCode: response.status,
        })
      return response.json()
    },
  )
  if (access !== 'allowed') {
    const statusCode =
      access === 'unauthenticated' ? 401 : access === 'forbidden' ? 403 : 503
    throw createError({
      statusCode,
      statusMessage:
        statusCode === 401
          ? 'Unauthorized'
          : statusCode === 403
            ? 'Forbidden'
            : 'Service Unavailable',
      message:
        access === 'unavailable'
          ? 'Não foi possível verificar seu acesso. Tente novamente.'
          : 'Esta área é exclusiva do administrador master.',
    })
  }
  return validateAgentChanges(source)
})
