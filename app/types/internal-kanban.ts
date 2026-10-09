// Internal project Kanban (temporary tool). Not part of the client product.
export type KanbanStatus = 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'DONE'

export interface KanbanTask {
  id: string
  title: string
  description: string | null
  status: KanbanStatus
  position: number
  created_at: string
  updated_at: string
}

export interface KanbanTaskInput {
  title: string
  description: string | null
}
