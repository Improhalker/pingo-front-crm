<script setup lang="ts">
import { ArrowLeft, CircleCheck, RotateCcw, X } from '@lucide/vue'
import { Alert, AlertDescription } from '~/components/ui/alert'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Skeleton } from '~/components/ui/skeleton'
import { ApiError } from '~/services/http'
import {
  methodLabel,
  paymentMethods,
  type PaymentMethod,
  type Expense,
  type Payment,
  type Revenue,
} from '~/types/finance'

definePageMeta({ middleware: 'auth' })
const route = useRoute()
const expenseId = computed(() => String(route.params.id))
const { organization, timezone, run, takeNotice } = useFinance()
const lane = createLatestRequest()
const writeLane = createLatestRequest()
const expense = ref<Expense | null>(null)
const loading = ref(false)
const loadError = ref('')
const notFound = ref(false)
const notice = ref('')
// The description (up to 160 characters) is the card heading; the navbar keeps a short, stable title.
usePageHeading(() => ({
  title: 'Despesa',
  crumbs: [
    ...(organization.value ? [{ label: organization.value.name }] : []),
    { label: 'Despesas', to: '/despesas' },
  ],
}))
const today = computed(() => todayIn(timezone.value))
const paidShare = computed(() => {
  if (!expense.value) return 0
  const total = toCents(expense.value.total_amount)
  return total > 0n
    ? Number((toCents(expense.value.paid_amount) * 100n) / total)
    : 0
})

async function reloadAfterEdit() {
  resetPaymentForm()
  await load()
  notice.value = 'Alterações salvas. As baixas anteriores foram preservadas.'
}

async function load() {
  if (!organization.value) return
  loading.value = true
  loadError.value = ''
  try {
    const result = await run(
      (api, signal) => api.expense(expenseId.value, signal),
      lane.begin(),
    )
    if (!result.ok) return
    expense.value = result.value.data
    // Untouched payment form starts with the expected method.
    if (!amountText.value)
      method.value = result.value.data.payable.expected_method
    notFound.value = false
    loading.value = false
  } catch (cause) {
    if (cause instanceof ApiError && cause.status === 404) {
      expense.value = null
      notFound.value = true
    } else {
      loadError.value = financeErrorMessage(
        cause,
        'Não foi possível carregar a despesa. Tente novamente.',
      )
    }
    loading.value = false
  }
}

// Payment (baixa)
const amountText = ref('')
const method = ref<PaymentMethod>('PIX')
const paidLocal = ref('')
const pending = ref(false)
const message = ref('')
const errors = ref<Record<string, string[]>>({})
const err = (key: string) => fieldMessage(errors.value, key)
const attempt = createIdempotentAttempt()
// Card 10: a settlement goes to one instalment, by default the next open one (or ?parcela=ID from reminders).
const selectedId = ref('')
const openInstallments = computed(() =>
  (expense.value?.installments ?? []).filter(
    (item) => toCents(item.remaining_amount) > 0n,
  ),
)
const target = computed(
  () =>
    openInstallments.value.find((item) => item.id === selectedId.value) ??
    openInstallments.value.find(
      (item) => item.id === expense.value?.payable.id,
    ) ??
    openInstallments.value[0] ??
    null,
)
const targetRemaining = computed(
  () =>
    target.value?.remaining_amount ?? expense.value?.remaining_amount ?? '0.00',
)
function installmentLabel(id: string) {
  const list = expense.value?.installments ?? []
  const line = list.find((item) => item.id === id)
  if (!line) return ''
  if (line.is_down_payment) return 'Entrada'
  const regular = list.filter((item) => !item.is_down_payment).length
  return `Parcela ${line.sequence - (list[0]?.is_down_payment ? 1 : 0)} de ${regular}`
}
function chooseInstallment(id: string) {
  selectedId.value = id
  const line = expense.value?.installments.find((item) => item.id === id)
  if (line) method.value = line.expected_method
  nextTick(() => document.getElementById('payment-amount')?.focus())
}
// Card 09: correction of a pagamento (the original stays in the history).
const correcting = ref<Payment | null>(null)
function afterCorrection(updated: Revenue | Expense) {
  expense.value = updated as Expense
  correcting.value = null
  resetPaymentForm()
  notice.value =
    'Correção registrada. O registro original continua no histórico e não entra mais nos totais.'
}
async function reloadAfterConflict() {
  correcting.value = null
  await load()
}
function resetPaymentForm() {
  selectedId.value =
    typeof route.query.parcela === 'string' ? route.query.parcela : ''
  amountText.value = ''
  method.value = expense.value?.payable.expected_method ?? 'PIX'
  paidLocal.value = nowLocalIn(timezone.value)
  message.value = ''
  errors.value = {}
  attempt.reset()
}
function fillRemaining() {
  if (expense.value) amountText.value = formatMoneyInput(targetRemaining.value)
}
function normalizeAmount() {
  const parsed = parseMoneyInput(amountText.value)
  if (parsed.ok) amountText.value = formatMoneyInput(parsed.value)
}
async function submitPayment() {
  const current = expense.value
  if (pending.value || !current) return
  message.value = ''
  notice.value = ''
  const found: Record<string, string[]> = {}
  const parsed = parseMoneyInput(amountText.value)
  if (!parsed.ok) found.amount = [parsed.error]
  else if (toCents(parsed.value) > toCents(targetRemaining.value))
    found.amount = [
      `O valor excede o restante a pagar ${current.installments.length > 1 ? 'desta parcela ' : ''}de ${formatMoney(targetRemaining.value)}.`,
    ]
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(paidLocal.value))
    found.paid_at = ['Informe a data e a hora do pagamento.']
  else if (paidLocal.value > nowLocalIn(timezone.value))
    found.paid_at = ['O pagamento não pode estar no futuro.']
  errors.value = found
  if (Object.keys(found).length || !parsed.ok) {
    message.value = 'Confira os campos indicados. Nada foi registrado.'
    return
  }
  let paidAt: string
  try {
    paidAt = zonedLocalToIso(paidLocal.value, timezone.value)
  } catch {
    errors.value = { paid_at: ['Informe uma data e hora válidas.'] }
    return
  }
  const payload = {
    amount: parsed.value,
    method: method.value,
    paid_at: paidAt,
  }
  lane.cancel()
  loading.value = false
  const ticket = writeLane.begin()
  pending.value = true
  try {
    const obligationId = target.value?.id ?? current.payable.id
    const key = attempt.keyFor({ payable: obligationId, payload })
    const result = await run(
      (api, signal) => api.registerPayment(obligationId, payload, key, signal),
      ticket,
    )
    if (!result.ok) return
    expense.value = result.value.data
    resetPaymentForm()
    notice.value =
      result.value.data.status === 'PAID'
        ? `Pagamento de ${formatMoney(payload.amount)} registrado. A despesa está quitada.`
        : `Pagamento de ${formatMoney(payload.amount)} registrado. Restam ${formatMoney(result.value.data.remaining_amount)}.`
  } catch (cause) {
    if (cause instanceof ApiError) {
      errors.value = cause.body.errors ?? {}
      message.value =
        cause.status === 422
          ? 'O pagamento não foi registrado. Confira os campos indicados.'
          : financeErrorMessage(
              cause,
              'Não foi possível confirmar o pagamento. Tente novamente com os mesmos dados para evitar duplicidade.',
            )
      // Another person may have registered a payment meanwhile: show the current remaining amount.
      if (cause.status === 422 && errors.value.amount) void load()
    } else {
      message.value =
        'Não recebemos a confirmação do servidor. Envie de novo: se o pagamento já tiver sido registrado, ele não será duplicado.'
    }
  } finally {
    if (ticket.isCurrent()) pending.value = false
  }
}

// Organization change, another expense or end of session: discard the previous record and draft.
watch(
  [() => organization.value?.id, expenseId],
  ([id]) => {
    lane.cancel()
    writeLane.cancel()
    expense.value = null
    loading.value = false
    loadError.value = ''
    notFound.value = false
    notice.value = takeNotice()
    pending.value = false
    resetPaymentForm()
    if (id) load()
  },
  { immediate: true },
)
onBeforeUnmount(() => {
  lane.cancel()
  writeLane.cancel()
})
const describedBy = (key: string, hint?: string) =>
  [hint, err(key) ? `payment-${key}-error` : ''].filter(Boolean).join(' ') ||
  undefined
</script>

<template>
  <FinanceContextGate>
    <div class="expense-detail">
      <div v-if="loading && !expense" class="card loading-card" role="status">
        <span class="sr-only">Carregando despesa…</span>
        <Skeleton class="h-6 w-64 max-w-full" />
        <Skeleton class="h-4 w-48 max-w-full" />
        <Skeleton class="h-20 w-full" />
      </div>

      <section
        v-else-if="notFound"
        class="card not-found"
        aria-labelledby="not-found-title"
      >
        <h2 id="not-found-title">Despesa não encontrada nesta empresa</h2>
        <p class="text-secondary">
          Ela pode pertencer a outra empresa ou o endereço está incorreto.
        </p>
        <div>
          <Button as-child variant="outline">
            <NuxtLink to="/despesas"
              ><ArrowLeft />Voltar para despesas</NuxtLink
            >
          </Button>
        </div>
      </section>

      <Alert
        v-else-if="loadError && !expense"
        variant="destructive"
        role="alert"
      >
        <AlertDescription class="error-line">
          {{ loadError }}
          <Button variant="outline" size="sm" @click="load">
            <RotateCcw />Tentar novamente
          </Button>
        </AlertDescription>
      </Alert>

      <template v-else-if="expense">
        <Alert
          v-if="notice"
          variant="success"
          role="status"
          class="dismissible"
        >
          <AlertDescription>{{ notice }}</AlertDescription>
          <Button
            variant="ghost"
            size="icon-sm"
            class="dismiss"
            @click="notice = ''"
          >
            <X :size="18" /><span class="sr-only">Fechar aviso</span>
          </Button>
        </Alert>

        <section class="card summary" aria-labelledby="summary-title">
          <div class="summary-head">
            <div class="summary-title">
              <h2 id="summary-title">{{ expense.description }}</h2>
              <p class="text-secondary">
                {{ expense.category.name }}
              </p>
            </div>
            <div class="entry-head-actions">
              <FinanceStatusBadge
                :status="expense.status"
              /><FinanceEntryActions
                :entry="expense"
                kind="expense"
                :disabled="pending || loading"
                @saved="reloadAfterEdit"
                @deleted="navigateTo('/despesas')"
              />
            </div>
          </div>
          <dl class="figures">
            <div>
              <dt>Total</dt>
              <dd class="tabular">{{ formatMoney(expense.total_amount) }}</dd>
            </div>
            <div>
              <dt>Pago</dt>
              <dd class="tabular">
                {{ formatMoney(expense.paid_amount) }}
              </dd>
            </div>
            <div class="figure-remaining">
              <dt>Restante</dt>
              <dd class="tabular">
                {{ formatMoney(expense.remaining_amount) }}
              </dd>
            </div>
          </dl>
          <div class="progress" aria-hidden="true">
            <span :style="{ width: `${paidShare}%` }" />
          </div>
          <p class="small text-secondary">
            {{ paidShare }}% do valor desta despesa foi pago. Apenas os
            pagamentos registrados compõem o valor pago.
          </p>
        </section>

        <div class="detail-grid">
          <section class="card" aria-labelledby="info-title">
            <h2 id="info-title">Dados da despesa</h2>
            <dl class="facts">
              <div>
                <dt>Categoria</dt>
                <dd>
                  {{ expense.category.name }}
                  <Badge v-if="expense.category.archived" variant="outline"
                    >Arquivada</Badge
                  >
                </dd>
              </div>

              <div>
                <dt>
                  {{
                    expense.installments.length > 1
                      ? 'Próximo vencimento'
                      : 'Vencimento'
                  }}
                </dt>
                <dd class="tabular">
                  {{ formatCivilDate(expense.payable.due_date) }}
                  <span
                    v-if="
                      expense.status === 'PENDING' &&
                      expense.payable.due_date === today
                    "
                    class="text-secondary"
                    >· vence hoje</span
                  >
                </dd>
              </div>
              <div>
                <dt>Forma prevista</dt>
                <dd>{{ methodLabel(expense.payable.expected_method) }}</dd>
              </div>
              <div>
                <dt>Registrada em</dt>
                <dd class="tabular">
                  {{ formatInstant(expense.created_at, timezone) }}
                </dd>
              </div>
              <div v-if="expense.notes" class="fact-wide">
                <dt>Observações</dt>
                <dd class="notes">{{ expense.notes }}</dd>
              </div>
            </dl>
            <p class="small text-secondary">
              O vencimento é um dia do calendário da empresa ({{ timezone }}).
            </p>
          </section>

          <section
            class="card payment-card"
            aria-labelledby="payment-form-title"
          >
            <template v-if="expense.status !== 'PAID'">
              <h2 id="payment-form-title">Registrar pagamento</h2>
              <form
                class="payment-form"
                :aria-busy="pending"
                novalidate
                @submit.prevent="submitPayment"
              >
                <p v-if="message" class="notice error" role="alert">
                  {{ message }}
                </p>
                <fieldset class="payment-fields" :disabled="pending">
                  <div v-if="openInstallments.length > 1" class="field">
                    <label for="payment-installment">Parcela</label>
                    <select
                      id="payment-installment"
                      class="control"
                      :value="target?.id"
                      @change="
                        chooseInstallment(
                          ($event.target as HTMLSelectElement).value,
                        )
                      "
                    >
                      <option
                        v-for="item in openInstallments"
                        :key="item.id"
                        :value="item.id"
                      >
                        {{ installmentLabel(item.id) }} · vence
                        {{ formatCivilDate(item.due_date) }} · resta
                        {{ formatMoney(item.remaining_amount) }}
                      </option>
                    </select>
                  </div>
                  <div class="field">
                    <label for="payment-amount">Valor pago</label>
                    <div class="money-input">
                      <span aria-hidden="true">R$</span>
                      <Input
                        id="payment-amount"
                        v-model="amountText"
                        inputmode="decimal"
                        autocomplete="off"
                        required
                        :aria-invalid="!!err('amount')"
                        :aria-describedby="
                          describedBy('amount', 'payment-amount-hint')
                        "
                        @blur="normalizeAmount"
                      />
                    </div>
                    <p id="payment-amount-hint" class="small text-secondary">
                      Restante{{
                        expense.installments.length > 1 ? ' desta parcela' : ''
                      }}: {{ formatMoney(targetRemaining) }}. Pode ser parcial.
                      <button
                        type="button"
                        class="link-button"
                        @click="fillRemaining"
                      >
                        Usar o restante
                      </button>
                    </p>
                    <p
                      v-if="err('amount')"
                      id="payment-amount-error"
                      class="small field-error"
                    >
                      {{ err('amount') }}
                    </p>
                  </div>
                  <div class="field">
                    <label for="payment-method">Forma do pagamento</label>
                    <select
                      id="payment-method"
                      v-model="method"
                      class="control"
                      required
                      :aria-invalid="!!err('method')"
                      :aria-describedby="describedBy('method')"
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
                      v-if="err('method')"
                      id="payment-method-error"
                      class="small field-error"
                    >
                      {{ err('method') }}
                    </p>
                  </div>
                  <div class="field">
                    <label for="payment-paid_at"
                      >Data e hora do pagamento</label
                    >
                    <Input
                      id="payment-paid_at"
                      v-model="paidLocal"
                      type="datetime-local"
                      min="2000-01-01T00:00"
                      required
                      :aria-invalid="!!err('paid_at')"
                      :aria-describedby="
                        describedBy('paid_at', 'payment-time-hint')
                      "
                    />
                    <p id="payment-time-hint" class="small text-secondary">
                      Horário de {{ timezone }}, o fuso da empresa.
                    </p>
                    <p
                      v-if="err('paid_at')"
                      id="payment-paid_at-error"
                      class="small field-error"
                    >
                      {{ err('paid_at') }}
                    </p>
                  </div>
                </fieldset>
                <p
                  v-if="err('idempotency_key')"
                  class="notice error"
                  role="alert"
                >
                  {{ err('idempotency_key') }}
                </p>
                <Button type="submit" :disabled="pending">
                  {{ pending ? 'Registrando…' : 'Registrar pagamento' }}
                </Button>
              </form>
            </template>
            <div v-else class="settled">
              <span class="settled-icon" aria-hidden="true"
                ><CircleCheck :size="22"
              /></span>
              <div>
                <h2 id="payment-form-title">Despesa quitada</h2>
                <p class="text-secondary">
                  Todos os pagamentos desta despesa foram registrados. Se um
                  pagamento foi registrado errado, use “Corrigir” no histórico:
                  o original fica guardado.
                </p>
              </div>
            </div>
          </section>
        </div>

        <section
          v-if="expense.installments.length > 1"
          class="installments"
          aria-labelledby="installments-title"
        >
          <h2 id="installments-title">Entrada e parcelas</h2>
          <FinanceInstallmentsTable
            :installments="expense.installments"
            kind="expense"
            :selected-id="target?.id"
            :disabled="pending || loading"
            @settle="chooseInstallment"
          />
        </section>

        <section class="payments" aria-labelledby="payments-title">
          <h2 id="payments-title">Pagamentos registrados</h2>
          <FinanceListCard v-if="!expense.payments?.length">
            <div class="list-empty">
              <p class="list-empty-title">Nenhum pagamento registrado.</p>
              <p class="text-secondary">
                A despesa continua a pagar até que você registre uma baixa.
              </p>
            </div>
          </FinanceListCard>
          <FinanceSettlementHistory
            v-if="expense.payments?.length"
            :items="expense.payments"
            kind="expense"
            :timezone="timezone"
            :installments="expense.installments"
            :disabled="pending || loading"
            @correct="(item) => (correcting = item as Payment)"
          />
        </section>
        <FinanceCorrectionDialog
          :entry="expense"
          kind="expense"
          :settlement="correcting"
          @close="correcting = null"
          @corrected="afterCorrection"
          @reload="reloadAfterConflict"
        />
      </template>
    </div>
  </FinanceContextGate>
</template>

<style scoped>
.expense-detail {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}
.loading-card,
.not-found {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  max-width: 720px;
}
.error-line {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--space-3);
}
.dismissible {
  grid-template-columns: 1fr auto;
  align-items: center;
}
.dismissible :deep([data-slot='alert-description']) {
  grid-column: 1;
}
.dismiss {
  grid-column: 2;
  grid-row: 1;
  color: inherit;
}
.summary {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}
.entry-head-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-3);
}
.summary-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--space-3);
}
.summary-title {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  min-width: 0;
}
.summary-title h2 {
  overflow-wrap: anywhere;
}
.figures {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-3);
  margin: 0;
}
.figures div {
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-control);
  background: var(--color-surface-secondary);
}
.figures dt {
  font-size: var(--type-secondary);
  color: var(--color-text-secondary);
}
.figures dd {
  margin: 0;
  font-size: var(--type-indicator);
  font-weight: var(--weight-brand);
  letter-spacing: var(--tracking-title);
  overflow-wrap: anywhere;
}
.figures .figure-remaining {
  background: var(--color-brand-subtle-bg);
}
.figures .figure-remaining dt,
.figures .figure-remaining dd {
  color: var(--color-brand-subtle-fg);
}
.progress {
  height: 8px;
  border-radius: 999px;
  background: var(--color-surface-secondary);
  overflow: hidden;
}
.progress span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--color-action-primary-bg);
}
.detail-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr);
  gap: var(--space-4);
  align-items: start;
}
.detail-grid > .card {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}
.facts {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-4);
  margin: 0;
}
.facts dt {
  font-size: var(--type-secondary);
  color: var(--color-text-secondary);
}
.facts dd {
  margin: 0;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
  font-weight: var(--weight-strong);
  overflow-wrap: anywhere;
}
.fact-wide {
  grid-column: 1 / -1;
}
.facts .notes {
  font-weight: var(--weight-normal);
  white-space: pre-line;
}
.payment-form,
.payment-fields {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}
.payment-fields {
  margin: 0;
  padding: 0;
  border: 0;
  min-width: 0;
}
.payment-form > button {
  align-self: flex-start;
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
.link-button {
  padding: 0;
  border: 0;
  background: none;
  color: var(--color-link);
  font: inherit;
  font-weight: var(--weight-heading);
  text-decoration: underline;
  text-underline-offset: 4px;
}
.settled {
  display: flex;
  align-items: flex-start;
  gap: var(--space-4);
}
.settled-icon {
  display: inline-grid;
  place-items: center;
  width: 44px;
  height: 44px;
  flex: none;
  border-radius: var(--radius-control);
  background: var(--color-status-success-bg);
  color: var(--color-status-success-fg);
}
.settled p {
  margin-top: var(--space-1);
}
.payments {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
@media (max-width: 1100px) {
  .detail-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
@media (max-width: 640px) {
  .figures {
    grid-template-columns: minmax(0, 1fr);
  }
  .figures div {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--space-3);
  }
  .figures dd {
    font-size: var(--type-section);
  }
  .facts {
    grid-template-columns: minmax(0, 1fr);
  }
  .payment-form > button {
    align-self: stretch;
  }
}
</style>
