// useState keys owned by the platform area; cleared whenever the session identity changes.
export const PLATFORM_STATE_KEYS = [
  'platform.list',
  'platform.meta',
  'platform.filters',
  'platform.loading',
  'platform.error',
  'platform.created',
  'platform.notice',
  'platform.detail',
  'platform.detailLoading',
  'platform.detailError',
  'platform.agentChanges',
  'platform.agentChangesLoading',
  'platform.agentChangesError',
]

export function fieldMessage(
  errors: Record<string, string[]> | undefined,
  key: string,
): string {
  return errors?.[key]?.[0] ?? ''
}
