<script setup lang="ts">
// Accessible confirmation for platform actions. With `requireText`, the exact text must be typed
// before confirming (used for permanent deletion); the backend checks it again.
const props = defineProps<{
  title: string
  confirmLabel: string
  pendingLabel: string
  danger?: boolean
  requireText?: string
  pending: boolean
  error?: string
}>()
const emit = defineEmits<{ confirm: [typed: string]; close: [] }>()
const dialog = useTemplateRef<HTMLDialogElement>('dialog')
const id = useId()
const typed = ref('')
const canConfirm = computed(
  () =>
    !props.pending && (!props.requireText || typed.value === props.requireText),
)
function open() {
  typed.value = ''
  dialog.value?.showModal()
}
function close() {
  dialog.value?.close()
}
defineExpose({ open, close })
</script>

<template>
  <dialog
    ref="dialog"
    class="platform-dialog card"
    role="alertdialog"
    :aria-labelledby="`${id}-title`"
    :aria-describedby="`${id}-text`"
    @cancel="pending && $event.preventDefault()"
    @close="emit('close')"
  >
    <form
      class="flex flex-col gap-6"
      @submit.prevent="canConfirm && emit('confirm', typed)"
    >
      <h2 :id="`${id}-title`">{{ title }}</h2>
      <div :id="`${id}-text`" class="flex flex-col gap-3 text-secondary">
        <slot />
      </div>
      <div v-if="requireText" class="field">
        <label :for="`${id}-typed`"
          >Digite <strong>{{ requireText }}</strong> para confirmar</label
        >
        <input
          :id="`${id}-typed`"
          v-model="typed"
          class="control"
          type="text"
          autocomplete="off"
          spellcheck="false"
          :disabled="pending"
        />
      </div>
      <p v-if="error" class="notice error" role="alert">{{ error }}</p>
      <div class="dialog-actions">
        <button
          class="button secondary"
          type="button"
          :disabled="pending"
          @click="close"
        >
          Cancelar
        </button>
        <button
          class="button"
          :class="{ danger }"
          type="submit"
          :disabled="!canConfirm"
        >
          {{ pending ? pendingLabel : confirmLabel }}
        </button>
      </div>
    </form>
  </dialog>
</template>
