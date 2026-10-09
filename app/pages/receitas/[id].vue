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
  type Receipt,
  type Revenue,
} from '~/types/finance'

definePageMeta({ middleware: 'auth' })
const route = useRoute()
const revenueId = computed(() => String(route.params.id))
const { organization, timezone, run, takeNotice } = useFinance()
const lane = createLatestRequest()
const revenue = ref<Revenue | null>(null)
const loading = ref(false)
const loadError = ref('')
const notFound = ref(false)
const notice = ref('')
// The description (up to 160 characters) is the card heading; the navbar keeps a short, stable title.
usePageHeading(() => ({
  title: 'Receita',
  crumbs: [
    ...(organization.value ? [{ label: organization.value.name }] : []),
    { label: 'Receitas', to: '/receitas' },
  ],
}))
const today = computed(() => todayIn(timezone.value))
const receivedShare = computed(() => {
  if (!revenue.value) return 0
  const total = toCents(revenue.value.total_amount)
  return total > 0n
    ? Number((toCents(revenue.value.received_amount) * 100n) / total)
    : 0
})

async function reloadAfterEdit() {
  resetReceiptForm()
  await load()
  notice.value = 'Alterações salvas. As baixas anteriores foram preservadas.'
}

async function load() {
  if (!organization.value) return
  loading.value = true
  loadError.value = ''
  try {
    const result = await run(
      (api, signal) => api.revenue(revenueId.value, signal),
      lane.begin(),
    )
    if (!result.ok) return
    revenue.value = result.value.data
    // Untouched receipt form starts with the expected method.
    if (!amountText.value)
      method.value = result.value.data.receivable.expected_method
    notFound.value = false
    loading.value = false
  } catch (cause) {
    if (cause instanceof ApiError && cause.status === 404) {
      revenue.value = null
      notFound.value = true
    } else {
      loadError.value = financeErrorMessage(
        cause,
        'Não foi possível carregar a receita. Tente novamente.',
      )
    }
    loading.value = false
  }
}

// Receipt (baixa)
const amountText = ref('')
const method = ref<PaymentMethod>('PIX')
const receivedLocal = ref('')
const pending = ref(false)
const message = ref('')
const errors = ref<Record<string, string[]>>({})
const err = (key: string) => fieldMessage(errors.value, key)
const attempt = createIdempotentAttempt()
// Card 10: a settlement goes to one instalment, by default the next open one (or ?parcela=ID from reminders).
const selectedId = ref('')
const openInstallments = computed(() =>
  (revenue.value?.installments ?? []).filter(
    (item) => toCents(item.remaining_amount) > 0n,
  ),
)
const target = computed(
  () =>
    openInstallments.value.find((item) => item.id === selectedId.value) ??
    openInstallments.value.find(
      (item) => item.id === revenue.value?.receivable.id,
    ) ??
    openInstallments.value[0] ??
    null,
)
const targetRemaining = computed(
  () =>
    target.value?.remaining_amount ?? revenue.value?.remaining_amount ?? '0.00',
)
function installmentLabel(id: string) {
  const list = revenue.value?.installments ?? []
  const line = list.find((item) => item.id === id)
  if (!line) return ''
  if (line.is_down_payment) return 'Entrada'
  const regular = list.filter((item) => !item.is_down_payment).length
  return `Parcela ${line.sequence - (list[0]?.is_down_payment ? 1 : 0)} de ${regular}`
}
function chooseInstallment(id: string) {
  selectedId.value = id
  const line = revenue.value?.installments.find((item) => item.id === id)
  if (line) method.value = line.expected_method
  nextTick(() => document.getElementById('receipt-amount')?.focus())
}
// Card 09: correction of a recebimento (the original stays in the history).
const correcting = ref<Receipt | null>(null)
function afterCorrection(updated: Revenue | Expense) {
  revenue.value = updated as Revenue
  correcting.value = null
  resetReceiptForm()
  notice.value =
    'Correção registrada. O registro original continua no histórico e não entra mais nos totais.'
}
async function reloadAfterConflict() {
  correcting.value = null
  await load()
}
function resetReceiptForm() {
  selectedId.value =
    typeof route.query.parcela === 'string' ? route.query.parcela : ''
  amountText.value = ''
  method.value = revenue.value?.receivable.expected_method ?? 'PIX'
  receivedLocal.value = nowLocalIn(timezone.value)
  message.value = ''
  errors.value = {}
  attempt.reset()
}
function fillRemaining() {
  if (revenue.value) amountText.value = formatMoneyInput(targetRemaining.value)
}
function normalizeAmount() {
  const parsed = parseMoneyInput(amountText.value)
  if (parsed.ok) amountText.value = formatMoneyInput(parsed.value)
}
async function submitReceipt() {
  const current = revenue.value
  if (pending.value || !current) return
  message.value = ''
  notice.value = ''
  const found: Record<string, string[]> = {}
  const parsed = parseMoneyInput(amountText.value)
  if (!parsed.ok) found.amount = [parsed.error]
  else if (toCents(parsed.value) > toCents(targetRemaining.value))
    found.amount = [
      `O valor excede o restante a receber ${current.installments.length > 1 ? 'desta parcela ' : ''}de ${formatMoney(targetRemaining.value)}.`,
    ]
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(receivedLocal.value))
    found.received_at = ['Informe a data e a hora do recebimento.']
  else if (receivedLocal.value > nowLocalIn(timezone.value))
    found.received_at = ['O recebimento não pode estar no futuro.']
  errors.value = found
  if (Object.keys(found).length || !parsed.ok) {
    message.value = 'Confira os campos indicados. Nada foi registrado.'
    return
  }
  const payload = {
    amount: parsed.value,
    method: method.value,
    received_at: zonedLocalToIso(receivedLocal.value, timezone.value),
  }
  pending.value = true
  try {
    const obligationId = target.value?.id ?? current.receivable.id
    const key = attempt.keyFor({ receivable: obligationId, payload })
    const result = await run((api, signal) =>
      api.registerReceipt(obligationId, payload, key, signal),
    )
    if (!result.ok) return
    revenue.value = result.value.data
    resetReceiptForm()
    notice.value =
      result.value.data.status === 'RECEIVED'
        ? `Recebimento de ${formatMoney(payload.amount)} registrado. A receita está quitada.`
        : `Recebimento de ${formatMoney(payload.amount)} registrado. Restam ${formatMoney(result.value.data.remaining_amount)}.`
  } catch (cause) {
    if (cause instanceof ApiError) {
      errors.value = cause.body.errors ?? {}
      message.value =
        cause.status === 422
          ? 'O recebimento não foi registrado. Confira os campos indicados.'
          : financeErrorMessage(
              cause,
              'Não foi possível registrar o recebimento. Nada foi registrado; tente novamente.',
            )
      // Another person may have registered a receipt meanwhile: show the current remaining amount.
      if (cause.status === 422 && errors.value.amount) void load()
    } else {
      message.value =
        'Não recebemos a confirmação do servidor. Envie de novo: se o recebimento já tiver sido registrado, ele não será duplicado.'
    }
  } finally {
    pending.value = false
  }
}

// Organization change, another revenue or end of session: discard the previous record and draft.
watch(
  [() => organization.value?.id, revenueId],
  ([id]) => {
    lane.cancel()
    revenue.value = null
    loading.value = false
    loadError.value = ''
    notFound.value = false
    notice.value = takeNotice()
    pending.value = false
    resetReceiptForm()
    if (id) load()
  },
  { immediate: true },
)
onBeforeUnmount(() => lane.cancel())
const describedBy = (key: string, hint?: string) =>
  [hint, err(key) ? `receipt-${key}-error` : ''].filter(Boolean).join(' ') ||
  undefined
</script>

<template>
  <FinanceContextGate>
    <div class="revenue-detail">
      <div v-if="loading && !revenue" class="card loading-card" role="status">
        <span class="sr-only">Carregando receita…</span>
        <Skeleton class="h-6 w-64 max-w-full" />
        <Skeleton class="h-4 w-48 max-w-full" />
        <Skeleton class="h-20 w-full" />
      </div>

      <section
        v-else-if="notFound"
        class="card not-found"
        aria-labelledby="not-found-title"
      >
        <h2 id="not-found-title">Receita não encontrada nesta empresa</h2>
        <p class="text-secondary">
          Ela pode pertencer a outra empresa ou o endereço está incorreto.
        </p>
        <div>
          <Button as-child variant="outline">
            <NuxtLink to="/receitas"
              ><ArrowLeft />Voltar para receitas</NuxtLink
            >
          </Button>
        </div>
      </section>

      <Alert
        v-else-if="loadError && !revenue"
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

      <template v-else-if="revenue">
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
              <h2 id="summary-title">{{ revenue.description }}</h2>
              <p class="text-secondary">
                {{ revenue.customer.name }} · {{ revenue.category.name }}
              </p>
            </div>
            <div class="entry-head-actions">
              <FinanceStatusBadge
                :status="revenue.status"
              /><FinanceEntryActions
                :entry="revenue"
                kind="revenue"
                :disabled="pending || loading"
                @saved="reloadAfterEdit"
                @deleted="navigateTo('/receitas')"
              />
            </div>
          </div>
          <dl class="figures">
            <div>
              <dt>Vendido</dt>
              <dd class="tabular">{{ formatMoney(revenue.total_amount) }}</dd>
            </div>
            <div>
              <dt>Recebido</dt>
              <dd class="tabular">
                {{ formatMoney(revenue.received_amount) }}
              </dd>
            </div>
            <div class="figure-remaining">
              <dt>Restante</dt>
              <dd class="tabular">
                {{ formatMoney(revenue.remaining_amount) }}
              </dd>
            </div>
          </dl>
          <div class="progress" aria-hidden="true">
            <span :style="{ width: `${receivedShare}%` }" />
          </div>
          <p class="small text-secondary">
            {{ receivedShare }}% do valor desta venda foi recebido. Os valores
            são calculados pelo servidor a partir das baixas registradas.
          </p>
        </section>

        <div class="detail-grid">
          <section class="card" aria-labelledby="info-title">
            <h2 id="info-title">Dados da venda</h2>
            <dl class="facts">
              <div>
                <dt>Cliente</dt>
                <dd>
                  {{ revenue.customer.name }}
                  <Badge v-if="revenue.customer.archived" variant="outline"
                    >Arquivado</Badge
                  >
                </dd>
              </div>
              <div>
                <dt>Categoria</dt>
                <dd>
                  {{ revenue.category.name }}
                  <Badge v-if="revenue.category.archived" variant="outline"
                    >Arquivada</Badge
                  >
                </dd>
              </div>
              <div>
                <dt>Data da venda</dt>
                <dd class="tabular">
                  {{ formatCivilDate(revenue.sale_date) }}
                </dd>
              </div>
              <div>
                <dt>
                  {{
                    revenue.installments.length > 1
                      ? 'Próximo vencimento'
                      : 'Vencimento'
                  }}
                </dt>
                <dd class="tabular">
                  {{ formatCivilDate(revenue.receivable.due_date) }}
                  <span
                    v-if="
                      revenue.status === 'PENDING' &&
                      revenue.receivable.due_date === today
                    "
                    class="text-secondary"
                    >· vence hoje</span
                  >
                </dd>
              </div>
              <div>
                <dt>Forma prevista</dt>
                <dd>{{ methodLabel(revenue.receivable.expected_method) }}</dd>
              </div>
              <div>
                <dt>Registrada em</dt>
                <dd class="tabular">
                  {{ formatInstant(revenue.created_at, timezone) }}
                </dd>
              </div>
              <div v-if="revenue.notes" class="fact-wide">
                <dt>Observações</dt>
                <dd class="notes">{{ revenue.notes }}</dd>
              </div>
            </dl>
            <p class="small text-secondary">
              Datas da venda e do vencimento são dias do calendário da empresa
              ({{ timezone }}).
            </p>
          </section>

          <section
            class="card receipt-card"
            aria-labelledby="receipt-form-title"
          >
            <template v-if="revenue.status !== 'RECEIVED'">
              <h2 id="receipt-form-title">Registrar recebimento</h2>
              <form
                class="receipt-form"
                :aria-busy="pending"
                novalidate
                @submit.prevent="submitReceipt"
              >
                <p v-if="message" class="notice error" role="alert">
                  {{ message }}
                </p>
                <fieldset class="receipt-fields" :disabled="pending">
                  <div v-if="openInstallments.length > 1" class="field">
                    <label for="receipt-installment">Parcela</label>
                    <select
                      id="receipt-installment"
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
                    <label for="receipt-amount">Valor recebido</label>
                    <div class="money-input">
                      <span aria-hidden="true">R$</span>
                      <Input
                        id="receipt-amount"
                        v-model="amountText"
                        inputmode="decimal"
                        autocomplete="off"
                        required
                        :aria-invalid="!!err('amount')"
                        :aria-describedby="
                          describedBy('amount', 'receipt-amount-hint')
                        "
                        @blur="normalizeAmount"
                      />
                    </div>
                    <p id="receipt-amount-hint" class="small text-secondary">
                      Restante{{
                        revenue.installments.length > 1 ? ' desta parcela' : ''
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
                      id="receipt-amount-error"
                      class="small field-error"
                    >
                      {{ err('amount') }}
                    </p>
                  </div>
                  <div class="field">
                    <label for="receipt-method">Forma do recebimento</label>
                    <select
                      id="receipt-method"
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
                      id="receipt-method-error"
                      class="small field-error"
                    >
                      {{ err('method') }}
                    </p>
                  </div>
                  <div class="field">
                    <label for="receipt-received_at"
                      >Data e hora do recebimento</label
                    >
                    <Input
                      id="receipt-received_at"
                      v-model="receivedLocal"
                      type="datetime-local"
                      min="2000-01-01T00:00"
                      required
                      :aria-invalid="!!err('received_at')"
                      :aria-describedby="
                        describedBy('received_at', 'receipt-time-hint')
                      "
                    />
                    <p id="receipt-time-hint" class="small text-secondary">
                      Horário de {{ timezone }}, o fuso da empresa.
                    </p>
                    <p
                      v-if="err('received_at')"
                      id="receipt-received_at-error"
                      class="small field-error"
                    >
                      {{ err('received_at') }}
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
                  {{ pending ? 'Registrando…' : 'Registrar recebimento' }}
                </Button>
              </form>
            </template>
            <div v-else class="settled">
              <span class="settled-icon" aria-hidden="true"
                ><CircleCheck :size="22"
              /></span>
              <div>
                <h2 id="receipt-form-title">Receita quitada</h2>
                <p class="text-secondary">
                  O valor total foi recebido. Se um recebimento foi registrado
                  errado, use “Corrigir” no histórico: o original fica guardado.
                </p>
              </div>
            </div>
          </section>
        </div>

        <section
          v-if="revenue.installments.length > 1"
          class="installments"
          aria-labelledby="installments-title"
        >
          <h2 id="installments-title">Entrada e parcelas</h2>
          <FinanceInstallmentsTable
            :installments="revenue.installments"
            kind="revenue"
            :selected-id="target?.id"
            :disabled="pending || loading"
            @settle="chooseInstallment"
          />
        </section>

        <section class="receipts" aria-labelledby="receipts-title">
          <h2 id="receipts-title">Recebimentos registrados</h2>
          <FinanceListCard v-if="!revenue.receipts?.length">
            <div class="list-empty">
              <p class="list-empty-title">Nenhum recebimento registrado.</p>
              <p class="text-secondary">
                A venda continua a receber até que você registre uma baixa.
              </p>
            </div>
          </FinanceListCard>
          <FinanceSettlementHistory
            v-if="revenue.receipts?.length"
            :items="revenue.receipts"
            kind="revenue"
            :timezone="timezone"
            :installments="revenue.installments"
            :disabled="pending || loading"
            @correct="(item) => (correcting = item as Receipt)"
          />
        </section>
        <FinanceCorrectionDialog
          :entry="revenue"
          kind="revenue"
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
.revenue-detail {
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
.receipt-form,
.receipt-fields {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}
.receipt-fields {
  margin: 0;
  padding: 0;
  border: 0;
  min-width: 0;
}
.receipt-form > button {
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
.receipts {
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
  .receipt-form > button {
    align-self: stretch;
  }
}
</style>
