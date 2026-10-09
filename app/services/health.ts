import type { ApiClient } from './http'
import type { ApiData, Health } from '../types/api'
export const readHealth = (api: ApiClient) =>
  api<ApiData<Health>>('/api/v1/health')
