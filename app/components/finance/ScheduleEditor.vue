<script setup lang="ts">
// Down payment and instalments of a new revenue/expense (card 10, ADR-032). Generates an editable preview
// (cents left over go to the last line; days 29–31 use the month's last day), checks the exact sum and
// builds the request lines. The down payment becomes a settlement only when explicitly marked; reminders
// are internal dates, independent of the due date, and never settle anything.
import { CalendarPlus } from '@lucide/vue'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import {
  paymentMethods,
  type PaymentMethod,
  type ScheduleLineInput,
} from '~/types/finance'

type Instant = 'received_at' | 'paid_at'
const props = defineProps<{
  kind: 'revenue' | 'expense'
  /** Total typed in the form (Brazilian format), parsed here. */
  totalText: string
  /** Civil date the due dates and the down payment cannot precede (sale date of a revenue). */
  notBefore?: string
  timezone: string
  disabled?: boolean
  errors: Record<string, string[]>
}>()
const noun = computed(() =>
  props.kind === 'revenue' ? 'recebimento' : 'pagamento',
)
const doneVerb = computed(() =>
  props.kind === 'revenue' ? 'Já recebi a entrada' : 'Já paguei a entrada',
)
const err = (key: string) => fieldMessage(props.errors, key)

// Generator
const downText = ref('')
const downSettled = ref(true)
const downMethod = ref<PaymentMethod>('PIX')
const downLocal = ref(nowLocalIn(props.timezone))
const downDue = ref(todayIn(props.timezone))
const count = ref(3)
const firstDue = ref(addMonthsKeepingDay(todayIn(props.timezone), 1))
const method = ref<PaymentMethod>('PIX')
const reminder = ref<'none' | '0' | '1' | '3' | '7'>('0')
const generateError = ref('')

interface Row {
  key: string
  amountText: string
  down_payment: boolean
  due_date: string
  expected_method: PaymentMethod
  reminder_date: string
}
const rows = ref<Row[]>([])

function parsedTotal() {
  const parsed = parseMoneyInput(props.totalText)
  return parsed.ok ? parsed.value : null
}
function generate() {
  generateError.value = ''
  const total = parsedTotal()
  if (!total) {
    generateError.value = 'Informe o valor total antes de gerar as parcelas.'
    return
  }
  let down: string | null = null
  if (downText.value.trim()) {
    const parsed = parseMoneyInput(downText.value)
    if (!parsed.ok) {
      generateError.value = `Entrada: ${parsed.error}`
      return
    }
    if (toCents(parsed.value) >= toCents(total)) {
      generateError.value = 'A entrada precisa ser menor que o total.'
      return
    }
    down = parsed.value
  }
  if (!Number.isInteger(count.value) || count.value < 1 || count.value > 59) {
    generateError.value = 'Use de 1 a 59 parcelas.'
    return
  }
  if (!down && count.value < 2) {
    generateError.value =
      'Sem entrada, um parcelamento precisa de pelo menos 2 parcelas.'
    return
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(firstDue.value)) {
    generateError.value = 'Informe o primeiro vencimento.'
    return
  }
  rows.value = buildPreview({
    total,
    downPayment: down,
    count: count.value,
    firstDue: firstDue.value,
    method: method.value,
    reminderDaysBefore:
      reminder.value === 'none' ? null : Number(reminder.value),
    downPaymentDue: downDue.value,
    downPaymentMethod: downMethod.value,
  }).map((line) => ({ ...line, amountText: formatMoneyInput(line.amount) }))
}

const regularCount = computed(
  () => rows.value.filter((row) => !row.down_payment).length,
)
function rowLabel(row: Row, index: number) {
  if (row.down_payment) return 'Entrada'
  return `Parcela ${index + (rows.value[0]?.down_payment ? 0 : 1)} de ${regularCount.value}`
}
const sum = computed(() => {
  let cents = 0n
  for (const row of rows.value) {
    const parsed = parseMoneyInput(row.amountText)
    if (!parsed.ok) return null
    cents += toCents(parsed.value)
  }
  return centsToString(cents)
})
const difference = computed(() => {
  const total = parsedTotal()
  return total && sum.value
    ? scheduleDifference(
        total,
        rows.value
          .map((row) => parseMoneyInput(row.amountText))
          .map((p) => (p.ok ? p.value : '0.00')),
      )
    : null
})
function normalize(row: Row) {
  const parsed = parseMoneyInput(row.amountText)
  if (parsed.ok) row.amountText = formatMoneyInput(parsed.value)
}

/** Validates the preview and returns the request lines, or the field errors to show. */
function build(instant: Instant): {
  errors: Record<string, string[]>
  lines?: ScheduleLineInput<Instant>[]
} {
  const errors: Record<string, string[]> = {}
  if (rows.value.length < 2) {
    errors.installments = [
      'Gere as parcelas e confira a prévia antes de registrar.',
    ]
    return { errors }
  }
  const lines: ScheduleLineInput<Instant>[] = []
  rows.value.forEach((row, index) => {
    const key = `installments.${index}`
    const parsed = parseMoneyInput(row.amountText)
    if (!parsed.ok) errors[`${key}.amount`] = [parsed.error]
    if (row.down_payment && downSettled.value) {
      if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(downLocal.value))
        errors[`${key}.settlement.${instant}`] = [
          `Informe a data e a hora do ${noun.value} da entrada.`,
        ]
      else if (downLocal.value > nowLocalIn(props.timezone))
        errors[`${key}.settlement.${instant}`] = [
          `O ${noun.value} não pode estar no futuro.`,
        ]
      else if (
        props.notBefore &&
        downLocal.value.slice(0, 10) < props.notBefore
      )
        errors[`${key}.settlement.${instant}`] = [
          `O ${noun.value} não pode ser anterior à data da venda.`,
        ]
      if (parsed.ok && !errors[`${key}.settlement.${instant}`])
        lines.push({
          amount: parsed.value,
          down_payment: true,
          settlement: {
            method: downMethod.value,
            [instant]: zonedLocalToIso(downLocal.value, props.timezone),
          } as { method: PaymentMethod } & Record<Instant, string>,
        })
      return
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(row.due_date))
      errors[`${key}.due_date`] = ['Informe o vencimento.']
    else if (props.notBefore && row.due_date < props.notBefore)
      errors[`${key}.due_date`] = [
        'O vencimento não pode ser anterior à data da venda.',
      ]
    if (parsed.ok)
      lines.push({
        amount: parsed.value,
        down_payment: row.down_payment,
        due_date: row.due_date,
        expected_method: row.expected_method,
        reminder_date: row.reminder_date || null,
      })
  })
  if (difference.value && toCents(difference.value) !== 0n)
    errors.installments = [
      `A soma das linhas (${formatMoney(sum.value!)}) precisa ser igual ao total. Diferença: ${formatMoney(difference.value)}.`,
    ]
  return Object.keys(errors).length ? { errors } : { errors, lines }
}
defineExpose({ build })
const describedBy = (key: string, hint?: string) =>
  [hint, err(key) ? `${key}-error` : ''].filter(Boolean).join(' ') || undefined
</script>

<template>
  <div class="schedule">
    <div class="generator">
      <div class="field">
        <label for="schedule-down"
          >Entrada <span class="optional">(opcional)</span></label
        >
        <div class="money-input">
          <span aria-hidden="true">R$</span>
          <Input
            id="schedule-down"
            v-model="downText"
            inputmode="decimal"
            autocomplete="off"
            :disabled="disabled"
            aria-describedby="schedule-down-hint"
          />
        </div>
        <p id="schedule-down-hint" class="small text-secondary">
          Deixe em branco se não houver entrada.
        </p>
      </div>
      <div v-if="downText.trim()" class="field down-mode">
        <label class="check">
          <input v-model="downSettled" type="checkbox" :disabled="disabled" />
          {{ doneVerb }}
        </label>
        <p class="small text-secondary">
          {{
            downSettled
              ? `A entrada entra como ${noun} já feito, na data informada.`
              : 'A entrada fica pendente, com vencimento próprio.'
          }}
        </p>
      </div>
      <template v-if="downText.trim() && downSettled">
        <div class="field">
          <label for="schedule-down-method">Forma da entrada</label>
          <select
            id="schedule-down-method"
            v-model="downMethod"
            class="control"
            :disabled="disabled"
          >
            <option
              v-for="item in paymentMethods"
              :key="item.value"
              :value="item.value"
            >
              {{ item.label }}
            </option>
          </select>
        </div>
        <div class="field">
          <label for="schedule-down-at">{{
            kind === 'revenue' ? 'Entrada recebida em' : 'Entrada paga em'
          }}</label>
          <Input
            id="schedule-down-at"
            v-model="downLocal"
            type="datetime-local"
            :max="nowLocalIn(timezone)"
            :disabled="disabled"
          />
        </div>
      </template>
      <template v-else-if="downText.trim()">
        <div class="field">
          <label for="schedule-down-due">Vencimento da entrada</label>
          <Input
            id="schedule-down-due"
            v-model="downDue"
            type="date"
            :min="notBefore || '2000-01-01'"
            max="2100-12-31"
            :disabled="disabled"
          />
        </div>
        <div class="field">
          <label for="schedule-down-method">Forma prevista da entrada</label>
          <select
            id="schedule-down-method"
            v-model="downMethod"
            class="control"
            :disabled="disabled"
          >
            <option
              v-for="item in paymentMethods"
              :key="item.value"
              :value="item.value"
            >
              {{ item.label }}
            </option>
          </select>
        </div>
      </template>
      <div class="field">
        <label for="schedule-count">Número de parcelas</label>
        <Input
          id="schedule-count"
          v-model.number="count"
          type="number"
          min="1"
          max="59"
          inputmode="numeric"
          :disabled="disabled"
        />
      </div>
      <div class="field">
        <label for="schedule-first">Primeiro vencimento</label>
        <Input
          id="schedule-first"
          v-model="firstDue"
          type="date"
          :min="notBefore || '2000-01-01'"
          max="2100-12-31"
          :disabled="disabled"
          aria-describedby="schedule-first-hint"
        />
        <p id="schedule-first-hint" class="small text-secondary">
          As demais vencem no mesmo dia dos meses seguintes. Nos meses sem esse
          dia (29 a 31), vale o último dia do mês.
        </p>
      </div>
      <div class="field">
        <label for="schedule-method">Forma prevista das parcelas</label>
        <select
          id="schedule-method"
          v-model="method"
          class="control"
          :disabled="disabled"
        >
          <option
            v-for="item in paymentMethods"
            :key="item.value"
            :value="item.value"
          >
            {{ item.label }}
          </option>
        </select>
      </div>
      <div class="field">
        <label for="schedule-reminder">Lembrete</label>
        <select
          id="schedule-reminder"
          v-model="reminder"
          class="control"
          :disabled="disabled"
          aria-describedby="schedule-reminder-hint"
        >
          <option value="none">Sem lembrete</option>
          <option value="0">No dia do vencimento</option>
          <option value="1">1 dia antes</option>
          <option value="3">3 dias antes</option>
          <option value="7">7 dias antes</option>
        </select>
        <p id="schedule-reminder-hint" class="small text-secondary">
          Aparece em Lembretes para você registrar o {{ noun }}. Nada é baixado
          automaticamente.
        </p>
      </div>
      <div class="generate">
        <Button
          type="button"
          variant="outline"
          :disabled="disabled"
          @click="generate"
        >
          <CalendarPlus aria-hidden="true" />{{
            rows.length ? 'Gerar novamente' : 'Gerar parcelas'
          }}
        </Button>
        <p v-if="rows.length" class="small text-secondary">
          Gerar novamente substitui a prévia abaixo.
        </p>
        <p v-if="generateError" class="small field-error" role="alert">
          {{ generateError }}
        </p>
      </div>
    </div>

    <div v-if="rows.length" class="preview">
      <h3 id="schedule-preview-title" class="preview-title">
        Prévia — confira e ajuste antes de registrar
      </h3>
      <ol class="rows" aria-labelledby="schedule-preview-title">
        <li v-for="(row, index) in rows" :key="row.key" class="row">
          <p class="row-label">{{ rowLabel(row, index) }}</p>
          <div class="field">
            <label :for="`installments.${index}.amount`">Valor</label>
            <div class="money-input">
              <span aria-hidden="true">R$</span>
              <Input
                :id="`installments.${index}.amount`"
                v-model="row.amountText"
                inputmode="decimal"
                autocomplete="off"
                :disabled="disabled"
                :aria-invalid="!!err(`installments.${index}.amount`)"
                :aria-describedby="describedBy(`installments.${index}.amount`)"
                @blur="normalize(row)"
              />
            </div>
            <p
              v-if="err(`installments.${index}.amount`)"
              :id="`installments.${index}.amount-error`"
              class="small field-error"
            >
              {{ err(`installments.${index}.amount`) }}
            </p>
          </div>
          <template v-if="row.down_payment && downSettled">
            <p class="small text-secondary settled-note">
              {{ kind === 'revenue' ? 'Recebida' : 'Paga' }} em
              {{
                downLocal
                  ? formatInstant(
                      zonedLocalToIso(downLocal, timezone),
                      timezone,
                    )
                  : '—'
              }}
              ·
              {{ paymentMethods.find((m) => m.value === downMethod)?.label }}
            </p>
            <p
              v-if="
                err(
                  `installments.${index}.settlement.${kind === 'revenue' ? 'received_at' : 'paid_at'}`,
                )
              "
              class="small field-error"
            >
              {{
                err(
                  `installments.${index}.settlement.${kind === 'revenue' ? 'received_at' : 'paid_at'}`,
                )
              }}
            </p>
          </template>
          <template v-else>
            <div class="field">
              <label :for="`installments.${index}.due_date`">Vencimento</label>
              <Input
                :id="`installments.${index}.due_date`"
                v-model="row.due_date"
                type="date"
                :min="notBefore || '2000-01-01'"
                max="2100-12-31"
                :disabled="disabled"
                :aria-invalid="!!err(`installments.${index}.due_date`)"
                :aria-describedby="
                  describedBy(`installments.${index}.due_date`)
                "
              />
              <p
                v-if="err(`installments.${index}.due_date`)"
                :id="`installments.${index}.due_date-error`"
                class="small field-error"
              >
                {{ err(`installments.${index}.due_date`) }}
              </p>
            </div>
            <div class="field">
              <label :for="`installments.${index}.expected_method`"
                >Forma prevista</label
              >
              <select
                :id="`installments.${index}.expected_method`"
                v-model="row.expected_method"
                class="control"
                :disabled="disabled"
              >
                <option
                  v-for="item in paymentMethods"
                  :key="item.value"
                  :value="item.value"
                >
                  {{ item.label }}
                </option>
              </select>
            </div>
            <div class="field">
              <label :for="`installments.${index}.reminder_date`"
                >Lembrete <span class="optional">(opcional)</span></label
              >
              <Input
                :id="`installments.${index}.reminder_date`"
                v-model="row.reminder_date"
                type="date"
                min="2000-01-01"
                max="2100-12-31"
                :disabled="disabled"
                :aria-invalid="!!err(`installments.${index}.reminder_date`)"
              />
            </div>
          </template>
        </li>
      </ol>
      <p
        class="sum"
        :class="{ mismatch: difference && toCents(difference) !== 0n }"
        role="status"
      >
        Soma das linhas:
        <strong class="tabular">{{ sum ? formatMoney(sum) : '—' }}</strong>
        <template v-if="difference && toCents(difference) === 0n">
          · confere com o total.</template
        >
        <template v-else-if="difference">
          · diferença de
          <strong class="tabular">{{ formatMoney(difference) }}</strong>
          para o total. Ajuste os valores.</template
        >
      </p>
    </div>
    <p v-if="err('installments')" class="notice error" role="alert">
      {{ err('installments') }}
    </p>
  </div>
</template>

<style scoped>
.schedule {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  min-width: 0;
}
.generator {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-4);
}
.generate,
.down-mode {
  grid-column: 1 / -1;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-3);
}
.check {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  font-weight: var(--weight-medium);
}
.check input {
  width: 18px;
  height: 18px;
  accent-color: var(--color-action-primary-bg);
}
.optional {
  font-weight: var(--weight-normal);
  color: var(--color-text-secondary);
}
.preview-title {
  font-size: var(--type-body);
  font-weight: var(--weight-strong);
  margin-bottom: var(--space-3);
}
.rows {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
.row {
  display: grid;
  grid-template-columns: minmax(96px, 0.7fr) repeat(4, minmax(0, 1fr));
  gap: var(--space-3);
  align-items: start;
  padding: var(--space-3);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-control);
}
.row-label {
  font-weight: var(--weight-strong);
  padding-top: var(--space-6);
}
.settled-note {
  grid-column: span 3;
  padding-top: var(--space-6);
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
  pointer-events: none;
}
.money-input :deep(input) {
  padding-left: 44px;
  font-variant-numeric: tabular-nums;
}
.sum {
  margin-top: var(--space-3);
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-control);
  background: var(--color-status-success-bg);
  color: var(--color-status-success-fg);
}
.sum.mismatch {
  background: var(--color-status-warning-bg);
  color: var(--color-status-warning-fg);
}
@media (max-width: 900px) {
  .row {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .row-label {
    grid-column: 1 / -1;
    padding-top: 0;
  }
  .settled-note {
    grid-column: 1 / -1;
    padding-top: 0;
  }
}
@media (max-width: 640px) {
  .generator,
  .row {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
