<script setup lang="ts">
// Create a category (name and type) or rename one. The type never changes after creation.
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
import { ApiError } from '~/services/http'
import type { Category, CategoryType } from '~/types/finance'

const props = defineProps<{
  category: Category | null
  defaultType: CategoryType
}>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ saved: [category: Category, created: boolean] }>()
const { run } = useFinance()
const id = useId()
const name = ref('')
const type = ref<string>('REVENUE')
const pending = ref(false)
const message = ref('')
const errors = ref<Record<string, string[]>>({})
const err = (key: string) => fieldMessage(errors.value, key)
const typeOptions = [
  { value: 'REVENUE', label: 'Receita' },
  { value: 'EXPENSE', label: 'Despesa' },
]
watch(open, (value) => {
  if (!value) return
  name.value = props.category?.name ?? ''
  type.value = props.category?.type ?? props.defaultType
  message.value = ''
  errors.value = {}
})
function keepOpenWhilePending(event: Event) {
  if (pending.value) event.preventDefault()
}
async function submit() {
  if (pending.value) return
  pending.value = true
  message.value = ''
  errors.value = {}
  const editing = props.category
  try {
    const result = await run((api, signal) =>
      editing
        ? api.renameCategory(editing.id, name.value.trim(), signal)
        : api.createCategory(
            { name: name.value.trim(), type: type.value as CategoryType },
            signal,
          ),
    )
    if (result.ok) {
      open.value = false
      emit('saved', result.value.data, !editing)
    }
  } catch (cause) {
    errors.value = cause instanceof ApiError ? (cause.body.errors ?? {}) : {}
    message.value = financeErrorMessage(
      cause,
      'Não foi possível salvar a categoria. Nada foi alterado; tente novamente.',
    )
  } finally {
    pending.value = false
  }
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent
      @escape-key-down="keepOpenWhilePending"
      @pointer-down-outside="keepOpenWhilePending"
    >
      <DialogHeader>
        <DialogTitle>{{
          category ? 'Renomear categoria' : 'Cadastrar categoria'
        }}</DialogTitle>
        <DialogDescription>
          <template v-if="category">
            É uma categoria de
            {{ category.type === 'REVENUE' ? 'receita' : 'despesa' }}. O tipo
            não muda depois de criada, para preservar o histórico.
          </template>
          <template v-else>
            Categorias organizam os lançamentos. O tipo não pode ser alterado
            depois.
          </template>
        </DialogDescription>
      </DialogHeader>
      <form class="dialog-form" novalidate @submit.prevent="submit">
        <p v-if="message" class="notice error" role="alert">{{ message }}</p>
        <fieldset class="dialog-fields" :disabled="pending">
          <div class="field">
            <label :for="`${id}-name`">Nome</label>
            <Input
              :id="`${id}-name`"
              v-model="name"
              required
              maxlength="80"
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
          <div v-if="!category" class="field">
            <span :id="`${id}-type`" class="field-label">Tipo</span>
            <AppSegmented
              v-model="type"
              :aria-labelledby="`${id}-type`"
              :options="typeOptions"
              :disabled="pending"
            />
            <p v-if="err('type')" class="small field-error">
              {{ err('type') }}
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
                : category
                  ? 'Salvar nome'
                  : 'Cadastrar categoria'
            }}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>

<style scoped>
.dialog-form,
.dialog-fields {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}
.dialog-fields {
  margin: 0;
  padding: 0;
  border: 0;
  min-width: 0;
}
.dialog-fields :deep(.segmented) {
  align-self: flex-start;
}
</style>
