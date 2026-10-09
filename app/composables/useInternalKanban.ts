import type {
  KanbanStatus,
  KanbanTask,
  KanbanTaskInput,
} from '~/types/internal-kanban'
import { ApiError } from '~/services/http'
import { internalKanbanService } from '~/services/internal-kanban'
import { createLatestRequest } from '~/utils/latest-request'
import { moveTask } from '~/utils/internal-kanban'

export type KanbanPhase = 'loading' | 'ready' | 'denied' | 'disabled' | 'error'

/**
 * State of the internal Kanban lives in the page that calls this composable (never in useState or
 * localStorage), so leaving the page, logging out or switching identity discards it and aborts requests.
 * One write is in flight at a time; the UI is blocked while `saving` is true.
 */
export function useInternalKanban() {
  const app = useNuxtApp()
  const service = internalKanbanService(app.$api)
  const requests = createLatestRequest()
  const tasks = ref<KanbanTask[]>([])
  const phase = ref<KanbanPhase>('loading')
  const saving = ref(false)
  const error = ref('')
  const status = ref('')
  let disposed = false

  const denied = {
    INTERNAL_KANBAN_DISABLED: 'disabled',
    INTERNAL_KANBAN_FORBIDDEN: 'denied',
  } as const

  function dispose() {
    disposed = true
    requests.cancel()
    tasks.value = []
    saving.value = false
  }

  /** Returns true when the failure was handled as a session/authorization problem. */
  async function handleAccess(cause: unknown): Promise<boolean> {
    if (!(cause instanceof ApiError)) return false
    const code = cause.body.code as keyof typeof denied
    if (cause.status === 403 && code in denied) {
      tasks.value = []
      phase.value = denied[code]
      return true
    }
    if (cause.status === 401 || cause.status === 419) {
      dispose()
      await navigateTo('/plataforma/login')
      return true
    }
    return false
  }

  async function load() {
    requests.cancel()
    const request = requests.begin()
    phase.value = 'loading'
    error.value = ''
    try {
      const response = await service.list(request.signal)
      if (!request.isCurrent() || disposed) return
      tasks.value = response.data
      phase.value = 'ready'
    } catch (cause) {
      if (!request.isCurrent() || disposed) return
      if (await handleAccess(cause)) return
      phase.value = 'error'
      error.value = 'Não foi possível carregar o quadro. Tente novamente.'
    }
  }

  /** Runs one write at a time. Returns the field errors of a 422 so forms can show them. */
  async function write<T>(
    action: (signal: AbortSignal) => Promise<T>,
    apply: (result: T) => void,
    failure: string,
    done: string,
  ): Promise<{ ok: boolean; errors?: Record<string, string[]> }> {
    if (saving.value || phase.value !== 'ready') return { ok: false }
    const request = requests.begin()
    saving.value = true
    error.value = ''
    status.value = 'Salvando…'
    try {
      const result = await action(request.signal)
      if (!request.isCurrent() || disposed) return { ok: false }
      apply(result)
      status.value = done
      return { ok: true }
    } catch (cause) {
      if (!request.isCurrent() || disposed) return { ok: false }
      status.value = ''
      if (await handleAccess(cause)) return { ok: false }
      if (cause instanceof ApiError && cause.status === 422) {
        return { ok: false, errors: cause.body.errors ?? {} }
      }
      error.value = failure
      return { ok: false }
    } finally {
      if (request.isCurrent()) saving.value = false
    }
  }

  const create = (input: KanbanTaskInput) =>
    write(
      (signal) => service.create(input, signal),
      (response) => {
        tasks.value = [...tasks.value, response.data].sort(byColumnOrder)
      },
      'Não foi possível criar a tarefa. Nada foi salvo.',
      'Tarefa criada.',
    )

  const update = (id: string, input: KanbanTaskInput) =>
    write(
      (signal) => service.update(id, input, signal),
      (response) => {
        tasks.value = tasks.value.map((task) =>
          task.id === id ? response.data : task,
        )
      },
      'Não foi possível salvar a tarefa. Nada foi alterado.',
      'Tarefa atualizada.',
    )

  const remove = (id: string) =>
    write(
      (signal) => service.remove(id, signal),
      () => {
        tasks.value = tasks.value.filter((task) => task.id !== id)
      },
      'Não foi possível excluir a tarefa. Ela continua no quadro.',
      'Tarefa excluída.',
    )

  async function move(id: string, to: KanbanStatus, index: number) {
    if (saving.value || phase.value !== 'ready') return { ok: false }
    const snapshot = tasks.value
    const optimistic = moveTask(snapshot, id, to, index)
    if (!optimistic) return { ok: false }
    tasks.value = optimistic
    const result = await write(
      (signal) => service.move(id, to, index, signal),
      (response) => {
        tasks.value = response.data
      },
      'Não foi possível mover a tarefa. Ela voltou à posição anterior.',
      'Tarefa movida.',
    )
    // A refused or failed write restores the previous position; the server state stays authoritative.
    if (!result.ok && !disposed && tasks.value === optimistic)
      tasks.value = snapshot
    return result
  }

  return {
    tasks,
    phase,
    saving,
    error,
    status,
    load,
    create,
    update,
    remove,
    move,
    dispose,
  }
}

const order: KanbanStatus[] = ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE']
function byColumnOrder(a: KanbanTask, b: KanbanTask) {
  return (
    order.indexOf(a.status) - order.indexOf(b.status) ||
    a.position - b.position ||
    Number(a.id) - Number(b.id)
  )
}
