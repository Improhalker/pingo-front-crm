<script setup lang="ts">
import type { KanbanTask } from '~/types/internal-kanban'

const props = defineProps<{
  saving: boolean
  confirm: (id: string) => Promise<{ ok: boolean }>
}>()
const dialog = useTemplateRef<HTMLDialogElement>('dialog')
const id = useId()
const task = ref<KanbanTask | null>(null)

function open(target: KanbanTask) {
  task.value = target
  dialog.value?.showModal()
}
async function confirmDelete() {
  if (!task.value) return
  const result = await props.confirm(task.value.id)
  if (result.ok) dialog.value?.close()
}
defineExpose({ open })
</script>

<template>
  <dialog
    ref="dialog"
    class="kanban-dialog card"
    role="alertdialog"
    :aria-labelledby="`${id}-heading`"
    :aria-describedby="`${id}-text`"
    @cancel="saving && $event.preventDefault()"
  >
    <div class="flex flex-col gap-6">
      <h2 :id="`${id}-heading`">Excluir tarefa?</h2>
      <p :id="`${id}-text`" class="text-secondary">
        “{{ task?.title }}” será removida do quadro. Esta ação não pode ser
        desfeita.
      </p>
      <div class="dialog-actions">
        <button
          class="button secondary"
          type="button"
          autofocus
          :disabled="saving"
          @click="dialog?.close()"
        >
          Cancelar
        </button>
        <button
          class="button danger"
          type="button"
          :disabled="saving"
          @click="confirmDelete"
        >
          {{ saving ? 'Excluindo…' : 'Excluir tarefa' }}
        </button>
      </div>
    </div>
  </dialog>
</template>

<style scoped>
.kanban-dialog {
  width: min(480px, calc(100vw - var(--space-8)));
  color: var(--color-text-primary);
  margin: auto;
}
.kanban-dialog::backdrop {
  background: color-mix(in srgb, var(--sidebar-bg) 65%, transparent);
}
.dialog-actions {
  display: flex;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: var(--space-3);
}
.button.danger {
  background: var(--color-status-danger-fg);
  color: var(--color-bg);
}
</style>
