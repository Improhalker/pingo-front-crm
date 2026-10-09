<script setup lang="ts">
import type { KanbanTask, KanbanTaskInput } from '~/types/internal-kanban'

const props = defineProps<{
  saving: boolean
  save: (
    id: string | null,
    input: KanbanTaskInput,
  ) => Promise<{ ok: boolean; errors?: Record<string, string[]> }>
}>()
const dialog = useTemplateRef<HTMLDialogElement>('dialog')
const titleField = useTemplateRef<HTMLInputElement>('titleField')
const id = useId()
const editingId = ref<string | null>(null)
const title = ref('')
const description = ref('')
const errors = ref<Record<string, string[]>>({})

function open(task?: KanbanTask) {
  editingId.value = task?.id ?? null
  title.value = task?.title ?? ''
  description.value = task?.description ?? ''
  errors.value = {}
  dialog.value?.showModal()
  titleField.value?.focus()
}
async function submit() {
  const cleanTitle = title.value.trim()
  if (!cleanTitle) {
    errors.value = { title: ['Informe um título.'] }
    titleField.value?.focus()
    return
  }
  const result = await props.save(editingId.value, {
    title: cleanTitle,
    description: description.value.trim() || null,
  })
  if (result.ok) dialog.value?.close()
  else if (result.errors) errors.value = result.errors
}
const otherError = computed(() => {
  const other = Object.entries(errors.value).find(
    ([field]) => field !== 'title' && field !== 'description',
  )
  return other ? other[1][0] || 'Confira os campos informados.' : ''
})
defineExpose({ open })
</script>

<template>
  <dialog
    ref="dialog"
    class="kanban-dialog card"
    :aria-labelledby="`${id}-heading`"
    @cancel="saving && $event.preventDefault()"
  >
    <form class="flex flex-col gap-6" novalidate @submit.prevent="submit">
      <h2 :id="`${id}-heading`">
        {{ editingId ? 'Editar tarefa' : 'Nova tarefa' }}
      </h2>
      <div class="field">
        <label :for="`${id}-title`">Título</label>
        <input
          :id="`${id}-title`"
          ref="titleField"
          v-model="title"
          class="control"
          maxlength="120"
          required
          :aria-invalid="errors.title ? 'true' : undefined"
          :aria-describedby="errors.title ? `${id}-title-error` : undefined"
        />
        <p
          v-if="errors.title"
          :id="`${id}-title-error`"
          class="small field-error"
        >
          {{ errors.title[0] }}
        </p>
      </div>
      <div class="field">
        <label :for="`${id}-description`">Descrição (opcional)</label>
        <textarea
          :id="`${id}-description`"
          v-model="description"
          class="control"
          rows="5"
          maxlength="2000"
          :aria-invalid="errors.description ? 'true' : undefined"
          :aria-describedby="`${id}-description-help`"
        />
        <p
          :id="`${id}-description-help`"
          class="small"
          :class="errors.description ? 'field-error' : 'text-secondary'"
        >
          {{
            errors.description?.[0] ?? 'Texto simples, até 2.000 caracteres.'
          }}
        </p>
      </div>
      <p v-if="otherError" class="small field-error" role="alert">
        {{ otherError }}
      </p>
      <div class="dialog-actions">
        <button
          class="button secondary"
          type="button"
          :disabled="saving"
          @click="dialog?.close()"
        >
          Cancelar
        </button>
        <button class="button" type="submit" :disabled="saving">
          {{ saving ? 'Salvando…' : 'Salvar tarefa' }}
        </button>
      </div>
    </form>
  </dialog>
</template>

<style scoped>
.kanban-dialog {
  width: min(520px, calc(100vw - var(--space-8)));
  color: var(--color-text-primary);
  margin: auto;
}
.kanban-dialog::backdrop {
  background: color-mix(in srgb, var(--sidebar-bg) 65%, transparent);
}
.field-error {
  color: var(--color-status-danger-fg);
}
.dialog-actions {
  display: flex;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: var(--space-3);
}
</style>
