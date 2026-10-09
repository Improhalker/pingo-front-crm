<script setup lang="ts">
// Create or edit a customer. The dialog closes only after the backend confirms the write.
import { Button } from '~/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import { Input } from '~/components/ui/input'
import { Textarea } from '~/components/ui/textarea'
import { ApiError } from '~/services/http'
import type { Customer, CustomerInput } from '~/types/finance'

const props = defineProps<{ customer: Customer | null }>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ saved: [customer: Customer, created: boolean] }>()
const { run } = useFinance()
const id = useId()
const form = reactive({
  name: '',
  phone: '',
  email: '',
  document: '',
  notes: '',
})
const pending = ref(false)
const message = ref('')
const errors = ref<Record<string, string[]>>({})
const err = (key: string) => fieldMessage(errors.value, key)
watch(open, (value) => {
  if (!value) return
  form.name = props.customer?.name ?? ''
  form.phone = props.customer?.phone ?? ''
  form.email = props.customer?.email ?? ''
  form.document = props.customer?.document ?? ''
  form.notes = props.customer?.notes ?? ''
  message.value = ''
  errors.value = {}
})
const optional = (value: string) => value.trim() || null
function keepOpenWhilePending(event: Event) {
  if (pending.value) event.preventDefault()
}
async function submit() {
  if (pending.value) return
  pending.value = true
  message.value = ''
  errors.value = {}
  const editing = props.customer
  const input: CustomerInput = {
    name: form.name.trim(),
    phone: optional(form.phone),
    email: optional(form.email),
    document: optional(form.document),
    notes: optional(form.notes),
  }
  try {
    const result = await run((api, signal) =>
      editing
        ? api.updateCustomer(editing.id, input, signal)
        : api.createCustomer(input, signal),
    )
    if (result.ok) {
      open.value = false
      emit('saved', result.value.data, !editing)
    }
  } catch (cause) {
    errors.value = cause instanceof ApiError ? (cause.body.errors ?? {}) : {}
    message.value = financeErrorMessage(
      cause,
      'Não foi possível salvar o cliente. Nada foi alterado; tente novamente.',
    )
  } finally {
    pending.value = false
  }
}
const fields = [
  { key: 'phone', label: 'Telefone', type: 'tel', max: 30, auto: 'tel' },
  { key: 'document', label: 'Documento', type: 'text', max: 30, auto: 'off' },
  { key: 'email', label: 'E-mail', type: 'email', max: 254, auto: 'email' },
] as const
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent
      class="sm:max-w-xl"
      @escape-key-down="keepOpenWhilePending"
      @pointer-down-outside="keepOpenWhilePending"
    >
      <DialogHeader>
        <DialogTitle>{{
          customer ? 'Editar cliente' : 'Cadastrar cliente'
        }}</DialogTitle>
        <DialogDescription>
          Só o nome é obrigatório. Telefone, e-mail, documento e observações
          ajudam a identificar o cliente.
        </DialogDescription>
      </DialogHeader>
      <form class="dialog-form" novalidate @submit.prevent="submit">
        <p v-if="message" class="notice error" role="alert">{{ message }}</p>
        <fieldset class="dialog-fields" :disabled="pending">
          <div class="field">
            <label :for="`${id}-name`">Nome</label>
            <Input
              :id="`${id}-name`"
              v-model="form.name"
              required
              maxlength="120"
              autocomplete="off"
              :aria-invalid="!!err('name')"
              :aria-describedby="err('name') ? `${id}-name-error` : undefined"
            />
            <p
              v-if="err('name')"
              :id="`${id}-name-error`"
              class="small field-error"
            >
              {{ err('name') }}
            </p>
          </div>
          <div class="field-row">
            <div
              v-for="field in fields"
              :key="field.key"
              class="field"
              :class="{ wide: field.key === 'email' }"
            >
              <label :for="`${id}-${field.key}`">
                {{ field.label }} <span class="optional">(opcional)</span>
              </label>
              <Input
                :id="`${id}-${field.key}`"
                v-model="form[field.key]"
                :type="field.type"
                :maxlength="field.max"
                :autocomplete="field.auto"
                :aria-invalid="!!err(field.key)"
                :aria-describedby="
                  err(field.key) ? `${id}-${field.key}-error` : undefined
                "
              />
              <p
                v-if="err(field.key)"
                :id="`${id}-${field.key}-error`"
                class="small field-error"
              >
                {{ err(field.key) }}
              </p>
            </div>
          </div>
          <div class="field">
            <label :for="`${id}-notes`">
              Observações <span class="optional">(opcional)</span>
            </label>
            <Textarea
              :id="`${id}-notes`"
              v-model="form.notes"
              maxlength="2000"
              rows="3"
              :aria-invalid="!!err('notes')"
              :aria-describedby="err('notes') ? `${id}-notes-error` : undefined"
            />
            <p
              v-if="err('notes')"
              :id="`${id}-notes-error`"
              class="small field-error"
            >
              {{ err('notes') }}
            </p>
          </div>
        </fieldset>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            :disabled="pending"
            @click="open = false"
          >
            Cancelar
          </Button>
          <Button type="submit" :disabled="pending">
            {{
              pending
                ? 'Salvando…'
                : customer
                  ? 'Salvar alterações'
                  : 'Cadastrar cliente'
            }}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>

<style scoped>
.dialog-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}
.dialog-fields {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  margin: 0;
  padding: 0;
  border: 0;
  min-width: 0;
}
.field-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 200px), 1fr));
  gap: var(--space-4);
}
.field-row .wide {
  grid-column: 1 / -1;
}
.optional {
  font-weight: var(--weight-normal);
  color: var(--color-text-secondary);
}
</style>
