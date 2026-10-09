import type { ApiError } from '../services/http'

// 403 codes meaning "this account cannot open its company" (ADR-028), as opposed to a missing permission.
export const ACCESS_DENIAL_CODES = [
  'ORGANIZATION_NONE',
  'ORGANIZATION_AMBIGUOUS',
  'ORGANIZATION_SUSPENDED',
]

export function isAccessDenial(cause: ApiError) {
  return (
    cause.status === 403 && ACCESS_DENIAL_CODES.includes(cause.body.code ?? '')
  )
}
