import type { ApiClient } from './http'
import type { ApiData } from '../types/api'
import type {
  KanbanStatus,
  KanbanTask,
  KanbanTaskInput,
} from '../types/internal-kanban'

const base = '/api/v1/internal/kanban/tasks'

export function internalKanbanService(api: ApiClient) {
  return {
    list: (signal?: AbortSignal) =>
      api<ApiData<KanbanTask[]>>(base, { signal }),
    create: (input: KanbanTaskInput, signal?: AbortSignal) =>
      api<ApiData<KanbanTask>>(base, { method: 'POST', body: input, signal }),
    update: (id: string, input: KanbanTaskInput, signal?: AbortSignal) =>
      api<ApiData<KanbanTask>>(`${base}/${id}`, {
        method: 'PATCH',
        body: input,
        signal,
      }),
    remove: (id: string, signal?: AbortSignal) =>
      api<undefined>(`${base}/${id}`, { method: 'DELETE', signal }),
    move: (
      id: string,
      status: KanbanStatus,
      position: number,
      signal?: AbortSignal,
    ) =>
      api<ApiData<KanbanTask[]>>(`${base}/${id}/move`, {
        method: 'POST',
        body: { status, position },
        signal,
      }),
  }
}
