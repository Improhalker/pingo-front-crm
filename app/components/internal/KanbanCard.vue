<script setup lang="ts">
import type { KanbanStatus, KanbanTask } from '~/types/internal-kanban'
import { kanbanColumns } from '~/utils/internal-kanban'

defineProps<{
  task: KanbanTask
  index: number
  count: number
  disabled: boolean
  dragging: boolean
}>()
const emit = defineEmits<{
  edit: []
  remove: []
  moveUp: []
  moveDown: []
  moveTo: [status: KanbanStatus]
  dragstart: [event: DragEvent]
  dragend: []
}>()
const id = useId()
</script>

<template>
  <li
    class="kanban-card"
    :class="{ dragging }"
    :data-task-id="task.id"
    :draggable="!disabled"
    @dragstart="emit('dragstart', $event)"
    @dragend="emit('dragend')"
  >
    <h3 :id="`${id}-title`">{{ task.title }}</h3>
    <p v-if="task.description" class="description small text-secondary">
      {{ task.description }}
    </p>
    <div class="card-controls">
      <div class="field move-field">
        <label :for="`${id}-move`">Mover para</label>
        <select
          :id="`${id}-move`"
          class="control"
          :value="task.status"
          :disabled="disabled"
          @change="
            emit(
              'moveTo',
              ($event.target as HTMLSelectElement).value as KanbanStatus,
            )
          "
        >
          <option
            v-for="column in kanbanColumns"
            :key="column.value"
            :value="column.value"
          >
            {{ column.label }}
          </option>
        </select>
      </div>
      <div class="card-buttons" role="group" :aria-labelledby="`${id}-title`">
        <button
          class="button secondary compact"
          type="button"
          :disabled="disabled || index === 0"
          :aria-label="`Subir ${task.title}`"
          @click="emit('moveUp')"
        >
          Subir
        </button>
        <button
          class="button secondary compact"
          type="button"
          :disabled="disabled || index === count - 1"
          :aria-label="`Descer ${task.title}`"
          @click="emit('moveDown')"
        >
          Descer
        </button>
        <button
          class="button secondary compact"
          type="button"
          :disabled="disabled"
          :aria-label="`Editar ${task.title}`"
          @click="emit('edit')"
        >
          Editar
        </button>
        <button
          class="button secondary compact"
          type="button"
          :disabled="disabled"
          :aria-label="`Excluir ${task.title}`"
          @click="emit('remove')"
        >
          Excluir
        </button>
      </div>
    </div>
  </li>
</template>

<style scoped>
.kanban-card {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-4);
  background: var(--color-surface);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-control);
  cursor: grab;
}
.kanban-card[draggable='false'] {
  cursor: default;
}
.kanban-card.dragging {
  opacity: 0.5;
  border-style: dashed;
}
h3 {
  margin: 0;
  font-size: var(--type-body);
  font-weight: var(--weight-heading);
  overflow-wrap: anywhere;
}
.description {
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  overflow-wrap: anywhere;
  white-space: pre-line;
}
.card-controls {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
.card-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}
.compact {
  min-height: 44px;
  padding: var(--space-2) var(--space-3);
  font-size: var(--type-secondary);
}
.move-field .control {
  min-height: 44px;
  padding: var(--space-2) var(--space-3);
}
</style>
