<script setup lang="ts">
import { RotateCcw } from '@lucide/vue'
import { Alert, AlertDescription } from '~/components/ui/alert'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Skeleton } from '~/components/ui/skeleton'
import { Textarea } from '~/components/ui/textarea'
import { ApiError } from '~/services/http'
import {
  paymentMethods,
  type Category,
  type Customer,
  type PaymentMethod,
  type RevenueInput,
} from '~/types/finance'

definePageMeta({ middleware: 'auth' })
const { organization, canManageCatalog, timezone, run, setNotice } =
  useFinance()
usePageHeading(() => ({
  title: 'Nova receita',
  crumbs: [
    ...(organization.value ? [{ label: organization.value.name }] : []),
    { label: 'Receitas', to: '/receitas' },
  ],
}))

// Options: active customers and active revenue categories of this organization.
const optionsLane = createLatestRequest()
const searchLane = createLatestRequest()
const customers = ref<Customer[]>([])
const customersTotal = ref(0)
const categories = ref<Category[]>([])
const optionsLoading = ref(false)
const optionsError = ref('')
const customerSearch = ref('')
const searchingCustomers = ref(false)
const pinnedCustomer = ref<Customer | null>(null)
const OPTIONS_LIMIT = 100

// Form
const customerId = ref('')
const categoryId = ref('')
const description = ref('')
const amountText = ref('')
const saleDate = ref('')
const dueDate = ref('')
const method = ref<PaymentMethod>('PIX')
// Card 06: pending (free due date) or explicitly received in full in this same submission.
const mode = ref<'pending' | 'settled' | 'installments'>('pending')
const modeOptions = [
  { value: 'pending', label: 'Ainda vou receber' },
  { value: 'settled', label: 'Já recebi à vista' },
  { value: 'installments', label: 'Parcelado' },
]
// Card 10: optional internal reminder of a pending entry, and the schedule editor of the "Parcelado" mode.
const pendingReminder = ref('')
const schedule = useTemplateRef<{
  build: (instant: 'received_at') => {
    errors: Record<string, string[]>
    lines?: NonNullable<RevenueInput['installments']>
  }
}>('schedule')
// The due date follows the sale date only as a suggestion, until the person picks one.
const dueTouched = ref(false)
const settleMethod = ref<PaymentMethod>('PIX')
const settledLocal = ref('')
const notes = ref('')
const pending = ref(false)
const message = ref('')
const errors = ref<Record<string, string[]>>({})
const err = (key: string) => fieldMessage(errors.value, key)
const attempt = createIdempotentAttempt()
const today = computed(() => todayIn(timezone.value))
const nowLocal = () => nowLocalIn(timezone.value)
watch(saleDate, (value) => {
  if (!dueTouched.value) dueDate.value = value
})

const customerOptions = computed(() => {
  const pin = pinnedCustomer.value
  return pin &&
    pin.id === customerId.value &&
    !customers.value.some((item) => item.id === pin.id)
    ? [pin, ...customers.value]
    : customers.value
})
watch(customerId, (id) => {
  const found = customers.value.find((item) => item.id === id)
  if (found) pinnedCustomer.value = found
})

async function loadOptions() {
  if (!organization.value) return
  optionsLoading.value = true
  optionsError.value = ''
  try {
    const result = await run(
      (api, signal) =>
        Promise.all([
          api.customers({ status: 'active', per_page: OPTIONS_LIMIT }, signal),
          api.categories(
            { status: 'active', type: 'REVENUE', per_page: OPTIONS_LIMIT },
            signal,
          ),
        ]),
      optionsLane.begin(),
    )
    if (!result.ok) return
    const [customerPage, categoryPage] = result.value
    customers.value = customerPage.data
    customersTotal.value = customerPage.meta.total
    categories.value = categoryPage.data
    optionsLoading.value = false
  } catch (cause) {
    optionsError.value = financeErrorMessage(
      cause,
      'Não foi possível carregar clientes e categorias. Tente novamente.',
    )
    optionsLoading.value = false
  }
}
async function searchCustomers() {
  searchingCustomers.value = true
  try {
    const result = await run(
      (api, signal) =>
        api.customers(
          {
            status: 'active',
            per_page: OPTIONS_LIMIT,
            search: customerSearch.value.trim(),
          },
          signal,
        ),
      searchLane.begin(),
    )
    if (!result.ok) return
    customers.value = result.value.data
    searchingCustomers.value = false
  } catch (cause) {
    optionsError.value = financeErrorMessage(
      cause,
      'Não foi possível buscar clientes. Tente novamente.',
    )
    searchingCustomers.value = false
  }
}

function normalizeAmount() {
  const parsed = parseMoneyInput(amountText.value)
  if (parsed.ok) amountText.value = formatMoneyInput(parsed.value)
}
function validate(): {
  errors: Record<string, string[]>
  amount?: string
  lines?: RevenueInput['installments']
} {
  const found: Record<string, string[]> = {}
  if (!customerId.value) found.customer_id = ['Escolha o cliente.']
  if (!categoryId.value) found.category_id = ['Escolha a categoria de receita.']
  if (description.value.trim().length < 3)
    found.description = ['Descreva a venda com ao menos 3 caracteres.']
  const parsed = parseMoneyInput(amountText.value)
  if (!parsed.ok) found.total_amount = [parsed.error]
  if (!saleDate.value) found.sale_date = ['Informe a data da venda.']
  else if (saleDate.value > today.value)
    found.sale_date = ['A data da venda não pode estar no futuro.']
  if (mode.value === 'pending') {
    if (!dueDate.value) found.due_date = ['Informe o vencimento.']
    else if (saleDate.value && dueDate.value < saleDate.value)
      found.due_date = ['O vencimento não pode ser anterior à data da venda.']
  } else if (!settledLocal.value) {
    found['settlement.received_at'] = [
      'Informe a data e a hora do recebimento.',
    ]
  } else if (settledLocal.value > nowLocal()) {
    found['settlement.received_at'] = [
      'O recebimento não pode estar no futuro.',
    ]
  } else if (
    saleDate.value &&
    settledLocal.value.slice(0, 10) < saleDate.value
  ) {
    found['settlement.received_at'] = [
      'O recebimento não pode ser anterior à data da venda.',
    ]
  }
  let lines: RevenueInput['installments']
  if (mode.value === 'installments') {
    const built = schedule.value?.build('received_at') ?? {
      errors: { installments: ['Gere as parcelas antes de registrar.'] },
    }
    Object.assign(found, built.errors)
    lines = built.lines
  }
  return { errors: found, amount: parsed.ok ? parsed.value : undefined, lines }
}
async function submit() {
  if (pending.value) return
  message.value = ''
  const checked = validate()
  errors.value = checked.errors
  if (Object.keys(checked.errors).length || !checked.amount) {
    message.value = 'Confira os campos indicados. Nada foi registrado.'
    return
  }
  const payload: RevenueInput = {
    customer_id: customerId.value,
    category_id: categoryId.value,
    description: description.value.trim(),
    total_amount: checked.amount,
    sale_date: saleDate.value,
    notes: notes.value.trim() || null,
    ...(mode.value === 'installments'
      ? { installments: checked.lines }
      : mode.value === 'settled'
        ? {
            settlement: {
              method: settleMethod.value,
              received_at: zonedLocalToIso(settledLocal.value, timezone.value),
            },
          }
        : {
            due_date: dueDate.value,
            expected_method: method.value,
            reminder_date: pendingReminder.value || null,
          }),
  }
  pending.value = true
  try {
    const key = attempt.keyFor(payload)
    const result = await run((api, signal) =>
      api.createRevenue(payload, key, signal),
    )
    if (!result.ok) return
    attempt.reset()
    const revenue = result.value.data
    setNotice(
      revenue.installments.length > 1
        ? `Receita parcelada registrada: ${formatMoney(revenue.total_amount)} de ${revenue.customer.name}, em ${revenue.installments.length} linhas. Recebido: ${formatMoney(revenue.received_amount)}; próximo vencimento em ${formatCivilDate(revenue.receivable.due_date)}.`
        : revenue.status === 'RECEIVED'
          ? `Receita registrada e recebida: ${formatMoney(revenue.total_amount)} de ${revenue.customer.name}. Não falta nada a receber.`
          : `Receita registrada: ${formatMoney(revenue.total_amount)} de ${revenue.customer.name}, com vencimento em ${formatCivilDate(revenue.receivable.due_date)}.`,
    )
    await navigateTo(`/receitas/${revenue.id}`)
  } catch (cause) {
    if (cause instanceof ApiError) {
      errors.value = cause.body.errors ?? {}
      message.value =
        cause.status === 422
          ? 'Confira os campos indicados. Nada foi registrado.'
          : financeErrorMessage(
              cause,
              'Não foi possível registrar a receita. Nada foi registrado; tente novamente.',
            )
    } else {
      // No answer from the server: the same attempt (same key) can be sent again without duplicating.
      message.value =
        'Não recebemos a confirmação do servidor. Envie de novo: se a receita já tiver sido registrada, ela não será duplicada.'
    }
  } finally {
    pending.value = false
  }
}

// Organization change or end of session: discard options, draft and pending attempt.
watch(
  () => organization.value?.id,
  (id) => {
    optionsLane.cancel()
    searchLane.cancel()
    customers.value = []
    customersTotal.value = 0
    categories.value = []
    optionsLoading.value = false
    optionsError.value = ''
    customerSearch.value = ''
    searchingCustomers.value = false
    pinnedCustomer.value = null
    customerId.value = ''
    categoryId.value = ''
    description.value = ''
    amountText.value = ''
    saleDate.value = id ? todayIn(timezone.value) : ''
    dueDate.value = saleDate.value
    dueTouched.value = false
    method.value = 'PIX'
    mode.value = 'pending'
    pendingReminder.value = ''
    settleMethod.value = 'PIX'
    settledLocal.value = id ? nowLocalIn(timezone.value) : ''
    notes.value = ''
    message.value = ''
    errors.value = {}
    attempt.reset()
    if (id) loadOptions()
  },
  { immediate: true },
)
onBeforeUnmount(() => {
  optionsLane.cancel()
  searchLane.cancel()
})
const describedBy = (key: string, hint?: string) =>
  [hint, err(key) ? `${key}-error` : ''].filter(Boolean).join(' ') || undefined
</script>

<template>
  <FinanceContextGate>
    <div class="new-revenue">
      <p class="intro text-secondary">
        Registre a venda e escolha se ela ainda será recebida ou se já foi
        recebida à vista. O valor só conta como recebido quando há uma baixa: no
        detalhe da receita ou, se escolher “Já recebi à vista”, neste mesmo
        envio.
      </p>

      <Alert v-if="optionsError" variant="destructive" role="alert">
        <AlertDescription class="error-line">
          {{ optionsError }}
          <Button variant="outline" size="sm" @click="loadOptions">
            <RotateCcw />Tentar novamente
          </Button>
        </AlertDescription>
      </Alert>

      <div
        v-if="optionsLoading"
        class="card loading-card"
        role="status"
        aria-live="polite"
      >
        <span class="sr-only">Carregando clientes e categorias…</span>
        <Skeleton class="h-5 w-48 max-w-full" />
        <Skeleton class="h-11 w-full" />
        <Skeleton class="h-11 w-full" />
      </div>

      <form
        v-else
        class="revenue-form"
        :aria-busy="pending"
        novalidate
        @submit.prevent="submit"
      >
        <p v-if="message" class="notice error" role="alert">{{ message }}</p>

        <fieldset class="card form-card" :disabled="pending">
          <legend class="section-legend">
            <span class="step" aria-hidden="true">1</span>Venda
          </legend>

          <div class="field wide">
            <label for="customer_id">Cliente</label>
            <div
              v-if="customersTotal > OPTIONS_LIMIT || customerSearch"
              class="customer-search"
            >
              <Input
                id="customer-search"
                v-model="customerSearch"
                type="search"
                maxlength="120"
                autocomplete="off"
                aria-label="Buscar cliente pelo nome"
                placeholder="Buscar cliente pelo nome"
                @keydown.enter.prevent="searchCustomers"
              />
              <Button
                type="button"
                variant="outline"
                :disabled="searchingCustomers"
                @click="searchCustomers"
              >
                {{ searchingCustomers ? 'Buscando…' : 'Buscar' }}
              </Button>
            </div>
            <select
              id="customer_id"
              v-model="customerId"
              class="control"
              required
              :disabled="!customerOptions.length"
              :aria-invalid="!!err('customer_id')"
              :aria-describedby="describedBy('customer_id', 'customer-hint')"
            >
              <option value="" disabled>Selecione o cliente</option>
              <option
                v-for="item in customerOptions"
                :key="item.id"
                :value="item.id"
              >
                {{ item.name }}{{ item.document ? ` · ${item.document}` : '' }}
              </option>
            </select>
            <p id="customer-hint" class="small text-secondary">
              <template v-if="!customersTotal">
                Nenhum cliente ativo.
                <NuxtLink v-if="canManageCatalog" to="/clientes"
                  >Cadastre um cliente</NuxtLink
                >
                <template v-else
                  >Peça a quem administra a empresa para cadastrar.</template
                >
              </template>
              <template v-else-if="customersTotal > OPTIONS_LIMIT">
                São {{ customersTotal }} clientes ativos; a lista mostra até
                {{ OPTIONS_LIMIT }}. Busque pelo nome para encontrar outros.
              </template>
              <template v-else>Somente clientes ativos aparecem aqui.</template>
            </p>
            <p
              v-if="err('customer_id')"
              id="customer_id-error"
              class="small field-error"
            >
              {{ err('customer_id') }}
            </p>
          </div>

          <div class="field">
            <label for="category_id">Categoria de receita</label>
            <select
              id="category_id"
              v-model="categoryId"
              class="control"
              required
              :disabled="!categories.length"
              :aria-invalid="!!err('category_id')"
              :aria-describedby="describedBy('category_id', 'category-hint')"
            >
              <option value="" disabled>Selecione a categoria</option>
              <option
                v-for="item in categories"
                :key="item.id"
                :value="item.id"
              >
                {{ item.name }}
              </option>
            </select>
            <p id="category-hint" class="small text-secondary">
              <template v-if="!categories.length">
                Nenhuma categoria de receita ativa.
                <NuxtLink v-if="canManageCatalog" to="/categorias"
                  >Cadastre uma categoria</NuxtLink
                >
                <template v-else
                  >Peça a quem administra a empresa para cadastrar.</template
                >
              </template>
              <template v-else>Somente categorias de receita ativas.</template>
            </p>
            <p
              v-if="err('category_id')"
              id="category_id-error"
              class="small field-error"
            >
              {{ err('category_id') }}
            </p>
          </div>

          <div class="field">
            <label for="total_amount">Valor total</label>
            <div class="money-input">
              <span aria-hidden="true">R$</span>
              <Input
                id="total_amount"
                v-model="amountText"
                inputmode="decimal"
                autocomplete="off"
                required
                :aria-invalid="!!err('total_amount')"
                :aria-describedby="describedBy('total_amount', 'amount-hint')"
                @blur="normalizeAmount"
              />
            </div>
            <p id="amount-hint" class="small text-secondary">
              Em reais, com até duas casas decimais. Exemplo: 1.000,00.
            </p>
            <p
              v-if="err('total_amount')"
              id="total_amount-error"
              class="small field-error"
            >
              {{ err('total_amount') }}
            </p>
          </div>

          <div class="field wide">
            <label for="description">Descrição</label>
            <Input
              id="description"
              v-model="description"
              maxlength="160"
              autocomplete="off"
              required
              :aria-invalid="!!err('description')"
              :aria-describedby="describedBy('description')"
            />
            <p
              v-if="err('description')"
              id="description-error"
              class="small field-error"
            >
              {{ err('description') }}
            </p>
          </div>

          <div class="field">
            <label for="sale_date">Data da venda</label>
            <Input
              id="sale_date"
              v-model="saleDate"
              type="date"
              min="2000-01-01"
              :max="today"
              required
              :aria-invalid="!!err('sale_date')"
              :aria-describedby="describedBy('sale_date')"
            />
            <p
              v-if="err('sale_date')"
              id="sale_date-error"
              class="small field-error"
            >
              {{ err('sale_date') }}
            </p>
          </div>

          <div class="field wide">
            <label for="notes"
              >Observações <span class="optional">(opcional)</span></label
            >
            <Textarea
              id="notes"
              v-model="notes"
              maxlength="2000"
              rows="3"
              :aria-invalid="!!err('notes')"
              :aria-describedby="describedBy('notes')"
            />
            <p v-if="err('notes')" id="notes-error" class="small field-error">
              {{ err('notes') }}
            </p>
          </div>
        </fieldset>

        <fieldset class="card form-card" :disabled="pending">
          <legend class="section-legend">
            <span class="step" aria-hidden="true">2</span>Recebimento
          </legend>
          <div class="field wide">
            <span id="receipt-mode-label" class="label"
              >Esta venda já foi recebida?</span
            >
            <AppSegmented
              v-model="mode"
              class="mode-switch"
              :options="modeOptions"
              :disabled="pending"
              aria-labelledby="receipt-mode-label"
              aria-describedby="receipt-mode-hint"
            />
            <p id="receipt-mode-hint" class="small text-secondary">
              <template v-if="mode === 'pending'"
                >O valor fica a receber até você registrar a baixa no detalhe da
                receita. Baixas parciais continuam possíveis.</template
              >
              <template v-else-if="mode === 'installments'"
                >Entrada opcional e parcelas com vencimento, forma e lembrete
                próprios. Só a entrada pode entrar como já recebida; as parcelas
                recebem baixa quando o dinheiro entrar.</template
              >
              <template v-else
                >O valor total entra como recebido na data informada. O
                vencimento interno passa a ser o mesmo dia do
                recebimento.</template
              >
            </p>
          </div>

          <template v-if="mode === 'pending'">
            <div class="field">
              <label for="due_date">Vencimento</label>
              <Input
                id="due_date"
                v-model="dueDate"
                type="date"
                :min="saleDate || '2000-01-01'"
                max="2100-12-31"
                required
                :aria-invalid="!!err('due_date')"
                :aria-describedby="describedBy('due_date', 'due-hint')"
                @input="dueTouched = true"
                @change="dueTouched = true"
              />
              <p id="due-hint" class="small text-secondary">
                Pode ser diferente da data da venda. No próprio dia do
                vencimento a receita ainda não está atrasada.
              </p>
              <p
                v-if="err('due_date')"
                id="due_date-error"
                class="small field-error"
              >
                {{ err('due_date') }}
              </p>
            </div>
            <div class="field">
              <label for="expected_method">Forma prevista</label>
              <select
                id="expected_method"
                v-model="method"
                class="control"
                required
                :aria-invalid="!!err('expected_method')"
                :aria-describedby="describedBy('expected_method')"
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
                id="expected_method-error"
                class="small field-error"
              >
                {{ err('expected_method') }}
              </p>
            </div>
            <div class="field">
              <label for="reminder_date"
                >Lembrete <span class="optional">(opcional)</span></label
              >
              <Input
                id="reminder_date"
                v-model="pendingReminder"
                type="date"
                min="2000-01-01"
                max="2100-12-31"
                :aria-invalid="!!err('reminder_date')"
                :aria-describedby="
                  describedBy('reminder_date', 'reminder-hint')
                "
              />
              <p id="reminder-hint" class="small text-secondary">
                Data em que a receita aparece em Lembretes para você registrar a
                baixa. Pode ser diferente do vencimento.
              </p>
              <p
                v-if="err('reminder_date')"
                id="reminder_date-error"
                class="small field-error"
              >
                {{ err('reminder_date') }}
              </p>
            </div>
          </template>

          <div v-else-if="mode === 'installments'" class="field wide">
            <FinanceScheduleEditor
              ref="schedule"
              kind="revenue"
              :total-text="amountText"
              :not-before="saleDate"
              :timezone="timezone"
              :disabled="pending"
              :errors="errors"
            />
          </div>

          <template v-else>
            <div class="field">
              <label for="settlement_method">Forma do recebimento</label>
              <select
                id="settlement_method"
                v-model="settleMethod"
                class="control"
                required
                :aria-invalid="!!err('settlement.method')"
                :aria-describedby="describedBy('settlement.method')"
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
                v-if="err('settlement.method')"
                id="settlement.method-error"
                class="small field-error"
              >
                {{ err('settlement.method') }}
              </p>
            </div>
            <div class="field">
              <label for="settlement_received_at">Recebido em</label>
              <Input
                id="settlement_received_at"
                v-model="settledLocal"
                type="datetime-local"
                :min="(saleDate || '2000-01-01') + 'T00:00'"
                :max="nowLocal()"
                required
                :aria-invalid="!!err('settlement.received_at')"
                :aria-describedby="
                  describedBy('settlement.received_at', 'settled-hint')
                "
              />
              <p id="settled-hint" class="small text-secondary">
                Data e hora no fuso da empresa ({{ timezone }}). Sugerimos
                agora; ajuste se recebeu antes.
              </p>
              <p
                v-if="err('settlement.received_at')"
                id="settlement.received_at-error"
                class="small field-error"
              >
                {{ err('settlement.received_at') }}
              </p>
            </div>
          </template>
        </fieldset>

        <p v-if="err('idempotency_key')" class="notice error" role="alert">
          {{ err('idempotency_key') }}
        </p>
        <div class="form-actions">
          <Button type="submit" size="lg" :disabled="pending">
            {{
              pending
                ? 'Registrando…'
                : mode === 'settled'
                  ? 'Registrar receita recebida'
                  : mode === 'installments'
                    ? 'Registrar receita parcelada'
                    : 'Registrar receita'
            }}
          </Button>
          <Button as-child variant="ghost" size="lg">
            <NuxtLink to="/receitas">Cancelar</NuxtLink>
          </Button>
        </div>
      </form>
    </div>
  </FinanceContextGate>
</template>

<style scoped>
.new-revenue {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
  max-width: 820px;
}
.intro {
  max-width: 64ch;
}
.loading-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}
.revenue-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}
.form-card {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-4);
  margin: 0;
  min-width: 0;
}
/* A floated legend becomes a normal grid item inside the card padding. */
.section-legend {
  float: left;
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: 0;
  font-size: var(--type-section);
  font-weight: var(--weight-strong);
}
.legend-note {
  grid-column: 1 / -1;
  margin-top: calc(var(--space-2) * -1);
}
.step {
  display: inline-grid;
  place-items: center;
  width: 32px;
  height: 32px;
  flex: none;
  border-radius: var(--radius-control);
  background: var(--color-brand-subtle-bg);
  color: var(--color-brand-subtle-fg);
  font-size: var(--type-secondary);
  font-weight: var(--weight-brand);
}
.wide {
  grid-column: 1 / -1;
}
/* Full width with wrapping labels, so both choices fit from 320px. */
.mode-switch {
  display: flex;
  width: 100%;
  height: auto;
  min-height: var(--control-height);
}
.mode-switch :deep(.segment) {
  min-height: 36px;
  padding: var(--space-1) var(--space-3);
  white-space: normal;
  line-height: 1.25;
}
.label {
  font-size: var(--type-secondary);
  font-weight: var(--weight-medium);
}
.optional {
  font-weight: var(--weight-normal);
  color: var(--color-text-secondary);
}
.customer-search {
  display: flex;
  gap: var(--space-2);
}
.money-input {
  position: relative;
}
.money-input span {
  position: absolute;
  top: 50%;
  left: var(--space-3);
  transform: translateY(-50%);
  color: var(--color-text-secondary);
  font-weight: var(--weight-heading);
  pointer-events: none;
}
.money-input :deep(input) {
  padding-left: 44px;
  font-variant-numeric: tabular-nums;
}
.error-line {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--space-3);
}
.form-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  padding-top: var(--space-2);
}
@media (max-width: 640px) {
  .form-card {
    grid-template-columns: minmax(0, 1fr);
  }
  .form-actions > * {
    flex: 1;
  }
}
</style>
