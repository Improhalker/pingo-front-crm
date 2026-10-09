<script setup lang="ts">
import { Pencil, Trash2, RefreshCw } from '@lucide/vue'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Alert, AlertDescription } from '~/components/ui/alert'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '~/components/ui/dialog'
import { ApiError } from '~/services/http'
import type { ApiData } from '~/types/api'
import {
  paymentMethods,
  type Revenue,
  type Expense,
  type PaymentMethod,
  type RevenueUpdateInput,
  type ExpenseUpdateInput,
} from '~/types/finance'

const props = defineProps<{
  entry: Revenue | Expense
  kind: 'revenue' | 'expense'
  disabled?: boolean
}>()
const emit = defineEmits<{ saved: []; deleted: [] }>()
const { organization, timezone, run, setNotice } = useFinance()
const id = useId()
const noun = computed(() => (props.kind === 'revenue' ? 'receita' : 'despesa'))
const open = ref(false)
const mode = ref<'edit' | 'delete'>('edit')
const loading = ref(false)
const saving = ref(false)
const message = ref('')
const conflict = ref(false)
const current = ref<Revenue | Expense | null>(null)
const errors = ref<Record<string, string[]>>({})
const err = (key: string) => fieldMessage(errors.value, key)
// Card 10: in an instalment schedule the total, due dates and methods stay as scheduled (ADR-032).
const scheduled = computed(
  () =>
    (current.value?.installments?.length ??
      props.entry.installments?.length ??
      0) > 1,
)
const lane = createLatestRequest()
const catalogs = createLatestRequest()
const writes = createLatestRequest()
const attempt = createIdempotentAttempt()
const form = reactive({
  description: '',
  category_id: '',
  customer_id: '',
  total: '',
  sale_date: '',
  due_date: '',
  expected_method: 'PIX' as PaymentMethod,
  notes: '',
})
type Option = { id: string; name: string; archived: boolean }
const categoryOptions = ref<Option[]>([])
const customerOptions = ref<Option[]>([])
const categorySearch = ref('')
const customerSearch = ref('')
const catalogError = ref('')
const catalogLoading = ref(false)
const settled = computed(() => {
  const entry = current.value ?? props.entry
  return 'received_amount' in entry ? entry.received_amount : entry.paid_amount
})
const canDelete = computed(() => toCents(settled.value) === 0n)
const categories = computed(() =>
  mergeOptions(categoryOptions.value, current.value?.category),
)
const customers = computed(() =>
  mergeOptions(
    customerOptions.value,
    current.value && 'customer' in current.value
      ? current.value.customer
      : undefined,
  ),
)
function mergeOptions(options: Option[], selected?: Option) {
  const entries = selected ? [selected, ...options] : options
  return [...new Map(entries.map((item) => [item.id, item])).values()]
}
function close(value: boolean) {
  if (saving.value) return
  open.value = value
  if (!value) {
    lane.cancel()
    catalogs.cancel()
    attempt.reset()
    current.value = null
  }
}
async function searchOptions() {
  catalogLoading.value = true
  catalogError.value = ''
  const ticket = catalogs.begin()
  try {
    const result = await run(async (api, signal) => {
      const [categories, customers] = await Promise.all([
        api.categories(
          {
            type: props.kind === 'revenue' ? 'REVENUE' : 'EXPENSE',
            status: 'active',
            per_page: 100,
            search: categorySearch.value.trim(),
          },
          signal,
        ),
        props.kind === 'revenue'
          ? api.customers(
              {
                status: 'active',
                per_page: 100,
                search: customerSearch.value.trim(),
              },
              signal,
            )
          : Promise.resolve(null),
      ])
      return { categories, customers }
    }, ticket)
    if (!result.ok) return
    categoryOptions.value = mergeOptions(
      result.value.categories.data,
      categoryOptions.value.find((item) => item.id === form.category_id),
    )
    customerOptions.value = mergeOptions(
      result.value.customers?.data ?? [],
      customerOptions.value.find((item) => item.id === form.customer_id),
    )
  } catch (cause) {
    catalogError.value = financeErrorMessage(
      cause,
      'Não foi possível carregar as opções. Tente buscar novamente.',
    )
  } finally {
    if (ticket.isCurrent()) catalogLoading.value = false
  }
}
async function begin(next: 'edit' | 'delete') {
  if (saving.value) return
  mode.value = next
  open.value = true
  loading.value = true
  message.value = ''
  conflict.value = false
  current.value = null
  errors.value = {}
  attempt.reset()
  categorySearch.value = ''
  customerSearch.value = ''
  categoryOptions.value = []
  customerOptions.value = []
  const ticket = lane.begin()
  try {
    const result = await run<ApiData<Revenue | Expense>>(
      (api, signal) =>
        props.kind === 'revenue'
          ? api.revenue(props.entry.id, signal)
          : api.expense(props.entry.id, signal),
      ticket,
    )
    if (!result.ok) return
    const entry = result.value.data
    current.value = entry
    const obligation = 'receivable' in entry ? entry.receivable : entry.payable
    Object.assign(form, {
      description: entry.description,
      category_id: entry.category.id,
      customer_id: 'customer' in entry ? entry.customer.id : '',
      total: formatMoneyInput(entry.total_amount),
      sale_date: 'sale_date' in entry ? entry.sale_date : '',
      due_date: obligation.due_date,
      expected_method: obligation.expected_method,
      notes: entry.notes ?? '',
    })
    if (next === 'edit') void searchOptions()
  } catch (cause) {
    message.value = financeErrorMessage(
      cause,
      'Não foi possível abrir o lançamento. Tente novamente.',
    )
  } finally {
    if (ticket.isCurrent()) loading.value = false
  }
}
async function submit() {
  const entry = current.value
  if (!entry || saving.value || loading.value || conflict.value) return
  message.value = ''
  errors.value = {}
  const parsed = parseMoneyInput(form.total)
  if (mode.value === 'edit') {
    if (!parsed.ok) errors.value.total_amount = [parsed.error]
    else if (toCents(parsed.value) < toCents(settled.value))
      errors.value.total_amount = [
        'O total não pode ser menor que o valor já recebido ou pago.',
      ]
    if (form.description.trim().length < 3)
      errors.value.description = [
        'Descreva o lançamento com ao menos 3 caracteres.',
      ]
    if (!form.category_id) errors.value.category_id = ['Escolha a categoria.']
    if (!scheduled.value && !form.due_date)
      errors.value.due_date = ['Informe o vencimento.']
    if (props.kind === 'revenue') {
      if (!form.customer_id) errors.value.customer_id = ['Escolha o cliente.']
      if (!form.sale_date || form.sale_date > todayIn(timezone.value))
        errors.value.sale_date = ['Informe uma data da venda válida, até hoje.']
      if (!scheduled.value && form.due_date < form.sale_date)
        errors.value.due_date = ['O vencimento não pode ser anterior à venda.']
    }
    if (Object.keys(errors.value).length) {
      message.value = 'Confira os campos indicados. Nada foi alterado.'
      return
    }
  } else if (!canDelete.value) return
  const payload: ExpenseUpdateInput = {
    category_id: form.category_id,
    description: form.description.trim(),
    total_amount: parsed.ok ? parsed.value : entry.total_amount,
    notes: form.notes.trim() || null,
    // Ignored by the server for schedules; kept valid against the sale date.
    due_date:
      scheduled.value && form.due_date < form.sale_date
        ? form.sale_date
        : form.due_date,
    expected_method: form.expected_method,
    expected_version: entry.version,
  }
  const revenuePayload: RevenueUpdateInput = {
    ...payload,
    customer_id: form.customer_id,
    sale_date: form.sale_date,
  }
  const ticket = writes.begin()
  saving.value = true
  try {
    const key = attempt.keyFor({
      kind: props.kind,
      mode: mode.value,
      id: entry.id,
      payload:
        mode.value === 'delete'
          ? { expected_version: entry.version }
          : props.kind === 'revenue'
            ? revenuePayload
            : payload,
    })
    const result = await run<unknown>(async (api, signal) => {
      if (mode.value === 'delete')
        return props.kind === 'revenue'
          ? api.deleteRevenue(entry.id, entry.version, key, signal)
          : api.deleteExpense(entry.id, entry.version, key, signal)
      return props.kind === 'revenue'
        ? api.updateRevenue(entry.id, revenuePayload, key, signal)
        : api.updateExpense(entry.id, payload, key, signal)
    }, ticket)
    if (!result.ok) return
    clearNuxtData()
    open.value = false
    attempt.reset()
    if (mode.value === 'delete') {
      setNotice(
        `${noun.value === 'receita' ? 'Receita' : 'Despesa'} excluída. O histórico foi preservado.`,
      )
      emit('deleted')
    } else emit('saved')
  } catch (cause) {
    if (cause instanceof ApiError) {
      errors.value = cause.body.errors ?? {}
      conflict.value =
        cause.status === 409 && cause.body.code === 'FINANCIAL_ENTRY_CHANGED'
      message.value =
        errors.value.entry?.[0] ??
        (cause.status === 422
          ? 'Confira os campos indicados. Nada foi alterado.'
          : financeErrorMessage(
              cause,
              'Não foi possível salvar. Tente novamente.',
            ))
    } else
      message.value =
        'Não recebemos a confirmação do servidor. Tente novamente: o reenvio desta operação não será duplicado.'
  } finally {
    if (ticket.isCurrent()) saving.value = false
  }
}
watch(
  () => [organization.value?.id, props.entry.id],
  () => {
    lane.cancel()
    catalogs.cancel()
    writes.cancel()
    open.value = false
    saving.value = false
    current.value = null
    attempt.reset()
  },
  { flush: 'sync' },
)
onBeforeUnmount(() => {
  lane.cancel()
  catalogs.cancel()
  writes.cancel()
})
</script>

<template>
  <div class="entry-actions">
    <Button
      type="button"
      variant="outline"
      :disabled="disabled || saving"
      :aria-label="`Editar ${noun}: ${entry.description}`"
      @click="begin('edit')"
      ><Pencil />Editar</Button
    >
    <Button
      type="button"
      variant="ghost"
      :disabled="disabled || saving"
      :aria-label="`Excluir ${noun}: ${entry.description}`"
      @click="begin('delete')"
      ><Trash2 />Excluir</Button
    >
  </div>
  <Dialog :open="open" @update:open="close">
    <DialogContent
      :show-close-button="!saving"
      @escape-key-down="saving && $event.preventDefault()"
      @interact-outside="saving && $event.preventDefault()"
    >
      <DialogHeader>
        <DialogTitle
          >{{ mode === 'edit' ? 'Editar' : 'Excluir' }} {{ noun
          }}{{ mode === 'delete' ? '?' : '' }}</DialogTitle
        >
        <DialogDescription>{{
          mode === 'edit'
            ? 'Corrija o cadastro. Recebimentos e pagamentos já registrados serão preservados.'
            : 'Confira o lançamento e o efeito antes de confirmar.'
        }}</DialogDescription>
      </DialogHeader>
      <p v-if="loading" role="status">Carregando os dados atuais…</p>
      <Alert v-if="message" variant="destructive" role="alert"
        ><AlertDescription>{{ message }}</AlertDescription></Alert
      >
      <Button
        v-if="conflict || (!loading && !current)"
        variant="outline"
        @click="begin(mode)"
        ><RefreshCw />{{
          conflict ? 'Recarregar e descartar rascunho' : 'Tentar novamente'
        }}</Button
      >
      <template v-if="current && !loading">
        <form
          v-if="mode === 'edit'"
          :id="`${id}-form`"
          class="entry-form"
          novalidate
          @submit.prevent="submit"
        >
          <fieldset :disabled="saving || conflict" class="entry-fields">
            <div>
              <label :for="`${id}-description`">Descrição do lançamento</label
              ><Input
                :id="`${id}-description`"
                v-model="form.description"
                maxlength="160"
                :aria-invalid="!!err('description')"
                :aria-describedby="
                  err('description') ? `${id}-description-error` : undefined
                "
              />
              <p
                v-if="err('description')"
                :id="`${id}-description-error`"
                class="field-error"
              >
                {{ err('description') }}
              </p>
            </div>
            <div v-if="kind === 'revenue'">
              <label :for="`${id}-customer-search`"
                >Buscar cliente pelo nome</label
              >
              <div class="option-search">
                <Input
                  :id="`${id}-customer-search`"
                  v-model="customerSearch"
                  maxlength="120"
                  @keydown.enter.prevent="searchOptions"
                /><Button
                  type="button"
                  variant="outline"
                  :disabled="catalogLoading"
                  @click="searchOptions"
                  >Buscar</Button
                >
              </div>
              <label :for="`${id}-customer`">Cliente</label
              ><select
                :id="`${id}-customer`"
                v-model="form.customer_id"
                class="select"
                :aria-invalid="!!err('customer_id')"
                :aria-describedby="
                  err('customer_id') ? `${id}-customer-error` : undefined
                "
              >
                <option value="">Escolha o cliente</option>
                <option
                  v-for="item in customers"
                  :key="item.id"
                  :value="item.id"
                >
                  {{ item.name
                  }}{{ item.archived ? ' (arquivado · vínculo atual)' : '' }}
                </option>
              </select>
              <p
                v-if="err('customer_id')"
                :id="`${id}-customer-error`"
                class="field-error"
              >
                {{ err('customer_id') }}
              </p>
            </div>
            <div>
              <label :for="`${id}-category-search`"
                >Buscar categoria pelo nome</label
              >
              <div class="option-search">
                <Input
                  :id="`${id}-category-search`"
                  v-model="categorySearch"
                  maxlength="120"
                  @keydown.enter.prevent="searchOptions"
                /><Button
                  type="button"
                  variant="outline"
                  :disabled="catalogLoading"
                  @click="searchOptions"
                  >Buscar</Button
                >
              </div>
              <label :for="`${id}-category`">Categoria</label
              ><select
                :id="`${id}-category`"
                v-model="form.category_id"
                class="select"
                :aria-invalid="!!err('category_id')"
                :aria-describedby="
                  err('category_id') ? `${id}-category-error` : undefined
                "
              >
                <option value="">Escolha a categoria</option>
                <option
                  v-for="item in categories"
                  :key="item.id"
                  :value="item.id"
                >
                  {{ item.name
                  }}{{ item.archived ? ' (arquivada · vínculo atual)' : '' }}
                </option>
              </select>
              <p
                v-if="err('category_id')"
                :id="`${id}-category-error`"
                class="field-error"
              >
                {{ err('category_id') }}
              </p>
              <p class="small text-secondary">
                Até 100 opções por busca. Busque pelo nome para encontrar
                outras.
              </p>
              <p v-if="catalogLoading" role="status" class="small">
                Buscando opções…
              </p>
              <p v-if="catalogError" role="alert" class="field-error">
                {{ catalogError }}
              </p>
            </div>
            <p v-if="scheduled" class="small text-secondary schedule-note">
              Lançamento parcelado: o total, os vencimentos e as formas das
              parcelas ficam como cadastrados. Aqui você corrige os demais
              dados.
            </p>
            <div v-if="!scheduled">
              <label :for="`${id}-total`">Valor total (R$)</label
              ><Input
                :id="`${id}-total`"
                v-model="form.total"
                inputmode="decimal"
                :aria-invalid="!!err('total_amount')"
                :aria-describedby="`${id}-total-help${err('total_amount') ? ` ${id}-total-error` : ''}`"
              />
              <p :id="`${id}-total-help`" class="small text-secondary">
                Já recebido ou pago: {{ formatMoney(settled) }}. O total não
                pode ser menor que esse valor.
              </p>
              <p
                v-if="err('total_amount')"
                :id="`${id}-total-error`"
                class="field-error"
              >
                {{ err('total_amount') }}
              </p>
            </div>
            <div v-if="kind === 'revenue'">
              <label :for="`${id}-sale`">Data da venda</label
              ><Input
                :id="`${id}-sale`"
                v-model="form.sale_date"
                type="date"
                min="2000-01-01"
                :max="todayIn(timezone)"
                :aria-invalid="!!err('sale_date')"
                :aria-describedby="
                  err('sale_date') ? `${id}-sale-error` : undefined
                "
              />
              <p
                v-if="err('sale_date')"
                :id="`${id}-sale-error`"
                class="field-error"
              >
                {{ err('sale_date') }}
              </p>
            </div>
            <div v-if="!scheduled">
              <label :for="`${id}-due`">Vencimento</label
              ><Input
                :id="`${id}-due`"
                v-model="form.due_date"
                type="date"
                :min="kind === 'revenue' ? form.sale_date : '2000-01-01'"
                max="2100-12-31"
                :aria-invalid="!!err('due_date')"
                :aria-describedby="
                  err('due_date') ? `${id}-due-error` : undefined
                "
              />
              <p
                v-if="err('due_date')"
                :id="`${id}-due-error`"
                class="field-error"
              >
                {{ err('due_date') }}
              </p>
            </div>
            <div v-if="!scheduled">
              <label :for="`${id}-method`">Forma prevista</label
              ><select
                :id="`${id}-method`"
                v-model="form.expected_method"
                class="select"
                :aria-invalid="!!err('expected_method')"
                :aria-describedby="
                  err('expected_method') ? `${id}-method-error` : undefined
                "
              >
                <option
                  v-for="item in paymentMethods"
                  :key="item.value"
                  :value="item.value"
                >
                  {{ item.label }}
                </option>
              </select>
              <p
                v-if="err('expected_method')"
                :id="`${id}-method-error`"
                class="field-error"
              >
                {{ err('expected_method') }}
              </p>
              <p class="small text-secondary">
                As formas e as datas das baixas anteriores continuam iguais.
              </p>
            </div>
            <div>
              <label :for="`${id}-notes`">Observações (opcional)</label
              ><textarea
                :id="`${id}-notes`"
                v-model="form.notes"
                class="textarea"
                maxlength="2000"
                rows="3"
                :aria-invalid="!!err('notes')"
                :aria-describedby="
                  err('notes') ? `${id}-notes-error` : undefined
                "
              />
              <p
                v-if="err('notes')"
                :id="`${id}-notes-error`"
                class="field-error"
              >
                {{ err('notes') }}
              </p>
            </div>
          </fieldset>
        </form>
        <div v-else class="delete-summary">
          <p>
            <strong>{{ current.description }}</strong>
          </p>
          <p>
            {{ formatMoney(current.total_amount) }} ·
            {{ current.category.name }}
          </p>
          <p v-if="canDelete">
            O lançamento sairá das listas e das pendências. O registro e sua
            auditoria serão preservados no histórico interno. Esta tela não
            oferece restauração.
          </p>
          <Alert v-else variant="destructive"
            ><AlertDescription
              >Este lançamento já tem {{ formatMoney(settled) }} em recebimentos
              ou pagamentos. A exclusão exige estorno, que ainda não está
              disponível. As baixas e o caixa serão
              preservados.</AlertDescription
            ></Alert
          >
        </div>
      </template>
      <DialogFooter class="entry-footer">
        <Button
          type="button"
          variant="outline"
          :disabled="saving"
          @click="close(false)"
          >Cancelar</Button
        >
        <Button
          v-if="mode === 'edit' && current && !loading"
          type="submit"
          :form="`${id}-form`"
          :disabled="saving || conflict"
          >{{ saving ? 'Salvando…' : 'Salvar alterações' }}</Button
        >
        <Button
          v-if="mode === 'delete' && current && !loading"
          type="button"
          variant="destructive"
          :disabled="saving || !canDelete || conflict"
          @click="submit"
          >{{ saving ? 'Excluindo…' : `Excluir ${noun}` }}</Button
        >
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<style scoped>
.entry-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}
.entry-actions button {
  white-space: normal;
}
.entry-form,
.entry-fields > div,
.entry-footer {
  min-width: 0;
}
.entry-fields input,
.entry-fields select,
.entry-fields textarea {
  min-width: 0;
  max-width: 100%;
}
.entry-fields,
.delete-summary {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  min-width: 0;
}
.entry-fields {
  border: 0;
  padding: 0;
  margin: 0;
}
.entry-fields label {
  display: block;
  margin-bottom: var(--space-1);
}
.option-search {
  display: flex;
  gap: var(--space-2);
  margin-bottom: var(--space-3);
}
.option-search input {
  min-width: 0;
}
.delete-summary {
  overflow-wrap: anywhere;
}
.entry-footer {
  flex-wrap: wrap;
}
@media (max-width: 400px) {
  .entry-footer button {
    width: 100%;
    white-space: normal;
    height: auto;
    min-height: 44px;
  }
}
</style>
