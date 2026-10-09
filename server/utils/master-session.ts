export type MasterAccess =
  'allowed' | 'unauthenticated' | 'forbidden' | 'unavailable'

type SessionReader = (
  url: string,
  options: {
    headers: Record<string, string>
    timeout: number
    retry: 0
    redirect: 'error'
  },
) => Promise<unknown>

/** Only the trusted session response can grant access. No client role/header is consulted. */
export async function checkMasterSession(
  apiBase: string,
  cookie: string | undefined,
  origin: string,
  readSession: SessionReader,
): Promise<MasterAccess> {
  if (!cookie) return 'unauthenticated'
  try {
    const response = await readSession(
      `${apiBase.replace(/\/$/, '')}/api/v1/auth/me`,
      {
        headers: {
          Accept: 'application/json',
          Cookie: cookie,
          Origin: origin,
          Referer: `${origin}/`,
          'X-Requested-With': 'XMLHttpRequest',
        },
        timeout: 5000,
        retry: 0,
        redirect: 'error',
      },
    )
    const data = (
      response as { data?: { is_platform_administrator?: unknown } } | null
    )?.data
    return data?.is_platform_administrator === true ? 'allowed' : 'forbidden'
  } catch (cause) {
    const status =
      (cause as { status?: number; statusCode?: number } | null)?.statusCode ??
      (cause as { status?: number } | null)?.status
    if (status === 401 || status === 419) return 'unauthenticated'
    if (status === 403) return 'forbidden'
    return 'unavailable'
  }
}
