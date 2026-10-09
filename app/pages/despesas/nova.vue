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
  type ExpenseInput,
  type PaymentMethod,
} from '~/types/finance'

definePageMeta({ middleware: 'auth' })
const { organization, canManageCatalog, timezone, run, setNotice } =
  useFinance()
usePageHeading(() => ({
  title: 'Nova despesa',
  crumbs: [
    ...(organization.value ? [{ label: organization.value.name }] : []),
    { label: 'Despesas', to: '/despesas' },
  ],
}))
const optionsLane = createLatestRequest()
const writeLane = createLatestRequest()
const categories = ref<Category[]>([])
const categoriesTotal = ref(0)
const categorySearch = ref('')
const pinnedCategory = ref<Category | null>(null)
const optionsLoading = ref(false)
const optionsError = ref('')
const categoryId = ref('')
const description = ref('')
const amountText = ref('')
const dueDate = ref('')
const method = ref<PaymentMethod>('PIX')
// Card 06: pending (free due date) or explicitly paid in full in this same submission.
const mode = ref<'pending' | 'settled' | 'installments'>('pending')
const modeOptions = [
  { value: 'pending', label: 'Ainda vou pagar' },
  { value: 'settled', label: 'Já paguei à vista' },
  { value: 'installments', label: 'Parcelado' },
]
// Card 10: optional internal reminder of a pending entry, and the schedule editor of the "Parcelado" mode.
const pendingReminder = ref('')
const schedule = useTemplateRef<{
  build: (instant: 'paid_at') => {
    errors: Record<string, string[]>
    lines?: NonNullable<ExpenseInput['installments']>
  }
}>('schedule')
const settleMethod = ref<PaymentMethod>('PIX')
const settledLocal = ref('')
const nowLocal = () => nowLocalIn(timezone.value)
const notes = ref('')
const pending = ref(false)
const message = ref('')
const errors = ref<Record<string, string[]>>({})
const err = (key: string) => fieldMessage(errors.value, key)
const describedBy = (key: string, hint?: string) =>
  [hint, err(key) ? `${key}-error` : ''].filter(Boolean).join(' ') || undefined
const attempt = createIdempotentAttempt()
const categoryOptions = computed(() => {
  const pin = pinnedCategory.value
  return pin &&
    pin.id === categoryId.value &&
    !categories.value.some((item) => item.id === pin.id)
    ? [pin, ...categories.value]
    : categories.value
})
watch(categoryId, (id) => {
  const selected = categories.value.find((item) => item.id === id)
  if (selected) pinnedCategory.value = selected
})

async function loadCategories() {
  if (!organization.value) return
  optionsLoading.value = true
  optionsError.value = ''
  try {
    const result = await run(
      (api, signal) =>
        api.categories(
          {
            status: 'active',
            type: 'EXPENSE',
            per_page: 100,
            search: categorySearch.value.trim(),
          },
          signal,
        ),
      optionsLane.begin(),
    )
    if (!result.ok) return
    categories.value = result.value.data
    if (!categorySearch.value.trim())
      categoriesTotal.value = result.value.meta.total
    optionsLoading.value = false
  } catch (cause) {
    optionsError.value = financeErrorMessage(
      cause,
      'Não foi possível carregar as categorias. Tente novamente.',
    )
    optionsLoading.value = false
  }
}
function normalizeAmount() {
  const parsed = parseMoneyInput(amountText.value)
  if (parsed.ok) amountText.value = formatMoneyInput(parsed.value)
}
async function submit() {
  if (pending.value || optionsLoading.value || optionsError.value) return
  message.value = ''
  const found: Record<string, string[]> = {}
  if (!categoryId.value) found.category_id = ['Escolha a categoria de despesa.']
  if (description.value.trim().length < 3)
    found.description = ['Descreva a despesa com ao menos 3 caracteres.']
  const parsed = parseMoneyInput(amountText.value)
  if (!parsed.ok) found.total_amount = [parsed.error]
  if (mode.value === 'installments') {
    // Validated by the schedule editor below.
  } else if (mode.value === 'pending') {
    if (!dueDate.value) found.due_date = ['Informe o vencimento.']
    else if (dueDate.value < '2000-01-01' || dueDate.value > '2100-12-31')
      found.due_date = ['Informe um vencimento entre 2000 e 2100.']
  } else if (!settledLocal.value) {
    found['settlement.paid_at'] = ['Informe a data e a hora do pagamento.']
  } else if (settledLocal.value > nowLocal()) {
    found['settlement.paid_at'] = ['O pagamento não pode estar no futuro.']
  }
  let lines: ExpenseInput['installments']
  if (mode.value === 'installments') {
    const built = schedule.value?.build('paid_at') ?? {
      errors: { installments: ['Gere as parcelas antes de registrar.'] },
    }
    Object.assign(found, built.errors)
    lines = built.lines
  }
  errors.value = found
  if (Object.keys(found).length || !parsed.ok) {
    message.value = 'Confira os campos indicados. Nada foi registrado.'
    return
  }
  const payload: ExpenseInput = {
    category_id: categoryId.value,
    description: description.value.trim(),
    total_amount: parsed.value,
    notes: notes.value.trim() || null,
    ...(mode.value === 'installments'
      ? { installments: lines }
      : mode.value === 'settled'
        ? {
            settlement: {
              method: settleMethod.value,
              paid_at: zonedLocalToIso(settledLocal.value, timezone.value),
            },
          }
        : {
            due_date: dueDate.value,
            expected_method: method.value,
            reminder_date: pendingReminder.value || null,
          }),
  }
  const ticket = writeLane.begin()
  pending.value = true
  try {
    const result = await run(
      (api, signal) =>
        api.createExpense(payload, attempt.keyFor(payload), signal),
      ticket,
    )
    if (!result.ok) return
    attempt.reset()
    const saved = result.value.data
    setNotice(
      saved.installments.length > 1
        ? `Despesa parcelada registrada: ${formatMoney(saved.total_amount)} em ${saved.installments.length} linhas. Pago: ${formatMoney(saved.paid_amount)}; próximo vencimento em ${formatCivilDate(saved.payable.due_date)}.`
        : saved.status === 'PAID'
          ? `Despesa registrada e paga: ${formatMoney(saved.total_amount)}. Não falta nada a pagar.`
          : `Despesa registrada: ${formatMoney(saved.total_amount)}, com vencimento em ${formatCivilDate(saved.payable.due_date)}.`,
    )
    await navigateTo(`/despesas/${result.value.data.id}`)
  } catch (cause) {
    if (cause instanceof ApiError) {
      errors.value = cause.body.errors ?? {}
      message.value =
        cause.status === 422
          ? 'Confira os campos indicados. Nada foi registrado.'
          : financeErrorMessage(
              cause,
              'Não foi possível confirmar a despesa. Tente novamente com os mesmos dados para evitar duplicidade.',
            )
    } else
      message.value =
        'Não recebemos a confirmação do servidor. Envie de novo com os mesmos dados: se a despesa já tiver sido registrada, ela não será duplicada.'
  } finally {
    if (ticket.isCurrent()) pending.value = false
  }
}
watch(
  () => organization.value?.id,
  (id) => {
    optionsLane.cancel()
    writeLane.cancel()
    categories.value = []
    categoriesTotal.value = 0
    categorySearch.value = ''
    pinnedCategory.value = null
    optionsLoading.value = false
    optionsError.value = ''
    categoryId.value = ''
    description.value = ''
    amountText.value = ''
    dueDate.value = id ? todayIn(timezone.value) : ''
    method.value = 'PIX'
    mode.value = 'pending'
    pendingReminder.value = ''
    settleMethod.value = 'PIX'
    settledLocal.value = id ? nowLocalIn(timezone.value) : ''
    notes.value = ''
    pending.value = false
    message.value = ''
    errors.value = {}
    attempt.reset()
    if (id) void loadCategories()
  },
  { immediate: true },
)
onBeforeUnmount(() => {
  optionsLane.cancel()
  writeLane.cancel()
})
</script>

<template>
  <FinanceContextGate>
    <div class="new-expense">
      <p class="intro text-secondary">
        Registre a conta e escolha se ela ainda será paga ou se já foi paga à
        vista. Ela só conta como saída quando há um pagamento: no detalhe da
        despesa ou, se escolher “Já paguei à vista”, neste mesmo envio.
      </p>
      <Alert v-if="optionsError" variant="destructive" role="alert">
        <AlertDescription class="error-line"
          >{{ optionsError
          }}<Button variant="outline" size="sm" @click="loadCategories"
            ><RotateCcw />Tentar novamente</Button
          ></AlertDescription
        >
      </Alert>
      <form
        class="expense-form"
        :aria-busy="pending"
        novalidate
        @submit.prevent="submit"
      >
        <p v-if="message" class="notice error" role="alert">{{ message }}</p>
        <fieldset class="card form-card" :disabled="pending">
          <legend class="section-legend">Dados da despesa</legend>
          <div class="field wide">
            <label for="category_id">Categoria de despesa</label>
            <div
              v-if="categoriesTotal > 100 || categorySearch"
              class="category-search"
            >
              <Input
                id="category-search"
                v-model="categorySearch"
                type="search"
                maxlength="120"
                aria-label="Buscar categoria pelo nome"
                @keydown.enter.prevent="loadCategories"
              />
              <Button
                type="button"
                variant="outline"
                :disabled="optionsLoading"
                @click="loadCategories"
                >Buscar categoria</Button
              >
            </div>
            <Skeleton
              v-if="optionsLoading"
              class="h-11 w-full"
              role="status"
              aria-label="Carregando categorias"
            />
            <select
              v-else
              id="category_id"
              v-model="categoryId"
              class="control"
              required
              :aria-invalid="!!err('category_id')"
              :aria-describedby="describedBy('category_id', 'category-hint')"
            >
              <option value="">Escolha uma categoria</option>
              <option
                v-for="category in categoryOptions"
                :key="category.id"
                :value="category.id"
              >
                {{ category.name }}
              </option>
            </select>
            <p id="category-hint" class="small text-secondary">
              <template
                v-if="!optionsLoading && !categoriesTotal && !optionsError"
                >Ainda não há categorias de despesa ativas.
              </template>
              <NuxtLink
                v-if="canManageCatalog"
                to="/categorias"
                class="text-link"
                >Gerenciar categorias</NuxtLink
              >
              <span v-else
                >O administrador da empresa mantém as categorias.</span
              >
            </p>
            <p
              v-if="err('category_id')"
              id="category_id-error"
              class="small field-error"
            >
              {{ err('category_id') }}
            </p>
          </div>
          <div class="field wide">
            <label for="description">Descrição</label>
            <Input
              id="description"
              v-model="description"
              maxlength="160"
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
            <label for="total_amount">Valor total (R$)</label>
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
            <p id="amount-hint" class="small text-secondary">
              Exemplo: 300,00. O pagamento pode ser parcial.
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
            <span id="payment-mode-label" class="label"
              >Esta despesa já foi paga?</span
            >
            <AppSegmented
              v-model="mode"
              class="mode-switch"
              :options="modeOptions"
              :disabled="pending"
              aria-labelledby="payment-mode-label"
              aria-describedby="payment-mode-hint"
            />
            <p id="payment-mode-hint" class="small text-secondary">
              <template v-if="mode === 'pending'"
                >Fica a pagar até você registrar o pagamento no detalhe da
                despesa. Pagamentos parciais continuam possíveis.</template
              >
              <template v-else-if="mode === 'installments'"
                >Entrada opcional e parcelas com vencimento, forma e lembrete
                próprios. Só a entrada pode entrar como já paga; as parcelas
                recebem baixa quando o dinheiro sair.</template
              >
              <template v-else
                >O valor total sai como pago na data informada. O vencimento
                interno passa a ser o mesmo dia do pagamento.</template
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
                min="2000-01-01"
                max="2100-12-31"
                required
                :aria-invalid="!!err('due_date')"
                :aria-describedby="describedBy('due_date', 'due-hint')"
              />
              <p id="due-hint" class="small text-secondary">
                Dia do calendário da empresa ({{ timezone }}). Pode ser uma
                conta vencida.
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
                Data em que a despesa aparece em Lembretes para você registrar a
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
              kind="expense"
              :total-text="amountText"
              :timezone="timezone"
              :disabled="pending"
              :errors="errors"
            />
          </div>

          <template v-else>
            <div class="field">
              <label for="settlement_method">Forma do pagamento</label>
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
              <label for="settlement_paid_at">Pago em</label>
              <Input
                id="settlement_paid_at"
                v-model="settledLocal"
                type="datetime-local"
                min="2000-01-01T00:00"
                :max="nowLocal()"
                required
                :aria-invalid="!!err('settlement.paid_at')"
                :aria-describedby="
                  describedBy('settlement.paid_at', 'paid-hint')
                "
              />
              <p id="paid-hint" class="small text-secondary">
                Data e hora no fuso da empresa ({{ timezone }}). Sugerimos
                agora; ajuste se pagou antes.
              </p>
              <p
                v-if="err('settlement.paid_at')"
                id="settlement.paid_at-error"
                class="small field-error"
              >
                {{ err('settlement.paid_at') }}
              </p>
            </div>
          </template>
          <div class="field wide">
            <label for="notes"
              >Observações <span class="text-secondary">(opcional)</span></label
            >
            <Textarea
              id="notes"
              v-model="notes"
              maxlength="2000"
              :aria-invalid="!!err('notes')"
              :aria-describedby="describedBy('notes')"
            />
            <p v-if="err('notes')" id="notes-error" class="small field-error">
              {{ err('notes') }}
            </p>
          </div>
        </fieldset>
        <p v-if="err('idempotency_key')" class="notice error" role="alert">
          {{ err('idempotency_key') }}
        </p>
        <div class="actions">
          <Button
            type="submit"
            :disabled="pending || optionsLoading || !!optionsError"
            >{{
              pending
                ? 'Registrando…'
                : mode === 'settled'
                  ? 'Registrar despesa paga'
                  : mode === 'installments'
                    ? 'Registrar despesa parcelada'
                    : 'Registrar despesa'
            }}</Button
          >
          <Button as-child variant="outline"
            ><NuxtLink to="/despesas">Voltar para despesas</NuxtLink></Button
          >
        </div>
      </form>
    </div>
  </FinanceContextGate>
</template>

<style scoped>
.new-expense,
.expense-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  max-width: 860px;
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
.intro {
  max-width: 65ch;
}
.form-card {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-5) var(--space-4);
  min-width: 0;
}
.section-legend {
  font-size: var(--type-section);
  font-weight: var(--weight-heading);
  padding: 0 var(--space-2);
}
.wide {
  grid-column: 1 / -1;
}
.actions,
.error-line,
.category-search {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-3);
}
.category-search input {
  flex: 1;
  min-width: 0;
}
@media (max-width: 640px) {
  .form-card {
    grid-template-columns: minmax(0, 1fr);
  }
  .actions > *,
  .category-search > * {
    width: 100%;
  }
}
</style>
