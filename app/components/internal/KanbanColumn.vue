<script setup lang="ts">
import type { KanbanStatus, KanbanTask } from '~/types/internal-kanban'
import { dropIndex } from '~/utils/internal-kanban'

const props = defineProps<{
  status: KanbanStatus
  label: string
  tasks: KanbanTask[]
  disabled: boolean
  draggingId: string | null
}>()
const emit = defineEmits<{
  edit: [task: KanbanTask]
  remove: [task: KanbanTask]
  move: [id: string, status: KanbanStatus, index: number]
  dragstart: [id: string]
  dragend: []
}>()
const id = useId()
const list = useTemplateRef<HTMLElement>('list')
const overIndex = ref<number | null>(null)

function indexAt(event: DragEvent) {
  const cards = [
    ...(list.value?.querySelectorAll<HTMLElement>('[data-task-id]') ?? []),
  ].filter((card) => card.dataset.taskId !== props.draggingId)
  return dropIndex(
    event.clientY,
    cards.map((card) => {
      const box = card.getBoundingClientRect()
      return box.top + box.height / 2
    }),
  )
}
function over(event: DragEvent) {
  if (!props.draggingId || props.disabled) return
  event.preventDefault()
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
  overIndex.value = indexAt(event)
}
function drop(event: DragEvent) {
  if (!props.draggingId || props.disabled) return
  event.preventDefault()
  const index = indexAt(event)
  overIndex.value = null
  emit('move', props.draggingId, props.status, index)
}
function leave(event: DragEvent) {
  if (
    !(event.currentTarget as HTMLElement).contains(event.relatedTarget as Node)
  )
    overIndex.value = null
}
function start(event: DragEvent, task: KanbanTask) {
  event.dataTransfer?.setData('text/plain', task.id)
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
  emit('dragstart', task.id)
}
// Card before which the dragged one would land (overIndex ignores the dragged card itself).
const beforeId = computed(() =>
  overIndex.value === null
    ? null
    : (props.tasks.filter((task) => task.id !== props.draggingId)[
        overIndex.value
      ]?.id ?? null),
)
</script>

<template>
  <section
    :id="`column-${status}`"
    class="kanban-column"
    :class="{ over: overIndex !== null }"
    :aria-labelledby="`${id}-heading`"
    @dragover="over"
    @dragleave="leave"
    @drop="drop"
  >
    <header class="column-heading">
      <h2 :id="`${id}-heading`">{{ label }}</h2>
      <span
        class="count small"
        :aria-label="`${tasks.length} ${tasks.length === 1 ? 'tarefa' : 'tarefas'}`"
        >{{ tasks.length }}</span
      >
    </header>
    <ul ref="list" class="column-list" :aria-labelledby="`${id}-heading`">
      <InternalKanbanCard
        v-for="(task, index) in tasks"
        :key="task.id"
        :task="task"
        :index="index"
        :count="tasks.length"
        :disabled="disabled"
        :dragging="draggingId === task.id"
        :class="{ 'drop-before': beforeId === task.id }"
        @edit="emit('edit', task)"
        @remove="emit('remove', task)"
        @move-up="emit('move', task.id, status, index - 1)"
        @move-down="emit('move', task.id, status, index + 1)"
        @move-to="(to) => emit('move', task.id, to, -1)"
        @dragstart="start($event, task)"
        @dragend="emit('dragend')"
      />
    </ul>
    <p v-if="!tasks.length" class="empty small text-secondary">
      Nenhuma tarefa nesta coluna.
    </p>
    <p
      v-if="draggingId && overIndex !== null"
      class="drop-hint small"
      aria-hidden="true"
    >
      Solte para mover para “{{ label }}”
    </p>
  </section>
</template>

<style scoped>
.kanban-column {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  min-width: 0;
  padding: var(--space-4);
  background: var(--color-surface-secondary);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-card);
  scroll-margin-top: var(--space-4);
}
.kanban-column.over {
  border-color: var(--color-focus);
  outline: 2px dashed var(--color-focus);
  outline-offset: -2px;
}
.column-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
}
h2 {
  font-size: var(--type-body);
}
.count {
  min-width: var(--space-6);
  padding: 0 var(--space-2);
  text-align: center;
  border-radius: var(--radius-control);
  background: var(--color-brand-subtle-bg);
  color: var(--color-brand-subtle-fg);
  font-weight: var(--weight-heading);
}
.column-list {
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  min-height: var(--space-8);
}
.column-list :deep(.drop-before) {
  box-shadow: 0 -4px 0 -1px var(--color-accent-bg);
}
.empty {
  margin: 0;
}
.drop-hint {
  margin: 0;
  color: var(--color-brand-subtle-fg);
  font-weight: var(--weight-heading);
}
</style>
