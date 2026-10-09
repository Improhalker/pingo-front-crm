import type { KanbanStatus, KanbanTask } from '../types/internal-kanban'

export const kanbanColumns: { value: KanbanStatus; label: string }[] = [
  { value: 'TODO', label: 'A fazer' },
  { value: 'IN_PROGRESS', label: 'Em andamento' },
  { value: 'IN_REVIEW', label: 'Em validação' },
  { value: 'DONE', label: 'Concluído' },
]

export function groupByStatus(
  tasks: KanbanTask[],
): Record<KanbanStatus, KanbanTask[]> {
  const groups: Record<KanbanStatus, KanbanTask[]> = {
    TODO: [],
    IN_PROGRESS: [],
    IN_REVIEW: [],
    DONE: [],
  }
  for (const task of tasks) groups[task.status].push(task)
  return groups
}

/**
 * Local (optimistic) move with the same semantics as the API: `index` is zero-based in the
 * destination column counted without the moved task. Returns undefined when nothing changes.
 */
export function moveTask(
  tasks: KanbanTask[],
  id: string,
  status: KanbanStatus,
  index: number,
): KanbanTask[] | undefined {
  const groups = groupByStatus(tasks)
  const task = tasks.find((item) => item.id === id)
  if (!task) return undefined
  const origin = task.status
  const originIndex = groups[origin].findIndex((item) => item.id === id)
  const target = groups[status].filter((item) => item.id !== id)
  if (!Number.isInteger(index) || index < 0 || index > target.length)
    return undefined
  if (origin === status && originIndex === index) return undefined
  target.splice(index, 0, { ...task, status })
  groups[status] = target
  if (origin !== status)
    groups[origin] = groups[origin].filter((i) => i.id !== id)
  return kanbanColumns.flatMap(({ value }) =>
    groups[value].map((item, position) => ({ ...item, position })),
  )
}

/** Where the dragged card would land, given the vertical middle of each other card in the column. */
export function dropIndex(pointerY: number, cardMiddles: number[]): number {
  return cardMiddles.filter((middle) => middle < pointerY).length
}
