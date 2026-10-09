<script setup lang="ts">
// Correction of one receipt/payment (card 09, ADR-031): edit → review before/after and the effect → confirm.
// Cancelling at any step changes nothing. The server keeps the original row, links the replacement and
// refuses a stale version (another change or settlement happened meanwhile).
import { ArrowLeft, ArrowRight, RefreshCw } from '@lucide/vue'
import { Alert, AlertDescription } from '~/components/ui/alert'
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
import {
  methodLabel,
  paymentMethods,
  type Expense,
  type Payment,
  type PaymentMethod,
  type Receipt,
  type Revenue,
} from '~/types/finance'

type Settlement = Receipt | Payment
const props = defineProps<{
  entry: Revenue | Expense
  kind: 'revenue' | 'expense'
  settlement: Settlement | null
}>()
const emit = defineEmits<{
  close: []
  corrected: [entry: Revenue | Expense]
  reload: []
}>()
const { timezone, run } = useFinance()
const noun = computed(() =>
  props.kind === 'revenue' ? 'recebimento' : 'pagamento',
)
const settledWord = computed(() =>
  props.kind === 'revenue' ? 'Recebido' : 'Pago',
)
const step = ref<'edit' | 'review'>('edit')
const amountText = ref('')
const method = ref<PaymentMethod>('PIX')
const local = ref('')
const reason = ref('')
const saving = ref(false)
const message = ref('')
const conflict = ref(false)
const errors = ref<Record<string, string[]>>({})
const err = (key: string) => fieldMessage(errors.value, key)
const attempt = createIdempotentAttempt()
const writes = createLatestRequest()
// Last selected row, kept while the dialog animates out so its content does not vanish mid-close.
const shown = ref<Settlement | null>(null)

const instantOf = (item: Settlement) =>
  'received_at' in item ? item.received_at : item.paid_at
const installment = computed(() =>
  props.entry.installments.find(
    (item) => item.id === shown.value?.installment_id,
  ),
)
const corrected = computed(() => {
  const parsed = parseMoneyInput(amountText.value)
  return parsed.ok ? parsed.value : null
})
const effect = computed(() =>
  installment.value && shown.value && corrected.value
    ? correctionEffect(
        installment.value.amount,
        installment.value.settled_amount,
        shown.value.amount,
        corrected.value,
      )
    : null,
)

watch(
  () => props.settlement,
  (item) => {
    if (!item) return
    shown.value = item
    step.value = 'edit'
    amountText.value = formatMoneyInput(item.amount)
    method.value = item.method
    local.value = nowLocalIn(timezone.value, new Date(instantOf(item)))
    reason.value = ''
    message.value = ''
    conflict.value = false
    errors.value = {}
    attempt.reset()
  },
  { immediate: true },
)

function close() {
  if (saving.value) return
  writes.cancel()
  emit('close')
}

function review() {
  const item = shown.value
  if (!item) return
  const found: Record<string, string[]> = {}
  const parsed = parseMoneyInput(amountText.value)
  if (!parsed.ok) found.amount = [parsed.error]
  else if (effect.value?.exceeds)
    found.amount = [
      `O valor corrigido não pode passar de ${formatMoney(effect.value.limit)}, o que falta desta parcela somado a esta baixa.`,
    ]
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local.value))
    found.instant = [`Informe a data e a hora do ${noun.value}.`]
  else if (local.value > nowLocalIn(timezone.value))
    found.instant = [`O ${noun.value} não pode estar no futuro.`]
  if (reason.value.trim().length < 5)
    found.reason = ['Explique o motivo da correção com ao menos 5 caracteres.']
  if (
    parsed.ok &&
    !found.instant &&
    toCents(parsed.value) === toCents(item.amount) &&
    method.value === item.method &&
    local.value === nowLocalIn(timezone.value, new Date(instantOf(item)))
  )
    found.amount = [
      'Nada mudou: altere o valor, a data/hora ou a forma para corrigir.',
    ]
  errors.value = found
  message.value = Object.keys(found).length
    ? 'Confira os campos indicados.'
    : ''
  if (!message.value) step.value = 'review'
}

async function confirm() {
  const item = shown.value
  if (!item || !corrected.value || saving.value) return
  const iso = zonedLocalToIso(local.value, timezone.value)
  const input = {
    expected_version: props.entry.version,
    amount: corrected.value,
    method: method.value,
    reason: reason.value.trim(),
    ...(props.kind === 'revenue' ? { received_at: iso } : { paid_at: iso }),
  }
  const ticket = writes.begin()
  saving.value = true
  message.value = ''
  conflict.value = false
  try {
    const key = attempt.keyFor({ id: item.id, input })
    const result = await run<{ data: Revenue | Expense }>((api, signal) =>
      props.kind === 'revenue'
        ? api.correctReceipt(item.id, input, key, signal)
        : api.correctPayment(item.id, input, key, signal),
    )
    if (!result.ok || !ticket.isCurrent()) return
    attempt.reset()
    emit('corrected', result.value.data)
  } catch (cause) {
    if (!ticket.isCurrent()) return
    if (cause instanceof ApiError && cause.status === 409) {
      conflict.value = true
      message.value = cause.message
    } else if (cause instanceof ApiError && cause.status === 422) {
      errors.value = {
        ...(cause.body.errors ?? {}),
        instant:
          cause.body.errors?.received_at ?? cause.body.errors?.paid_at ?? [],
      }
      step.value = 'edit'
      message.value =
        'A correção não foi registrada. Confira os campos indicados.'
    } else if (cause instanceof ApiError) {
      message.value = financeErrorMessage(
        cause,
        'Não foi possível registrar a correção. Nada foi alterado; tente novamente.',
      )
    } else {
      message.value =
        'Não recebemos a confirmação do servidor. Confirme de novo: se a correção já tiver sido registrada, ela não será duplicada.'
    }
  } finally {
    if (ticket.isCurrent()) saving.value = false
  }
}
onBeforeUnmount(() => writes.cancel())
</script>

<template>
  <Dialog :open="!!settlement" @update:open="(value) => !value && close()">
    <DialogContent
      :show-close-button="!saving"
      @escape-key-down="saving && $event.preventDefault()"
      @interact-outside="saving && $event.preventDefault()"
    >
      <DialogHeader>
        <DialogTitle>{{
          step === 'edit' ? `Corrigir ${noun}` : 'Revisar a correção'
        }}</DialogTitle>
        <DialogDescription>
          {{
            step === 'edit'
              ? `Use para um ${noun} registrado com valor, data/hora ou forma errados. O registro original fica guardado no histórico.`
              : 'Confira antes e depois. Nada muda até você confirmar.'
          }}
        </DialogDescription>
      </DialogHeader>

      <p v-if="message" class="notice error" role="alert">{{ message }}</p>
      <Alert v-if="conflict" variant="destructive">
        <AlertDescription class="conflict-line">
          Recarregue o lançamento para ver os valores atuais antes de corrigir.
          <Button variant="outline" size="sm" @click="emit('reload')">
            <RefreshCw aria-hidden="true" />Recarregar
          </Button>
        </AlertDescription>
      </Alert>

      <form
        v-if="shown && step === 'edit'"
        class="correction-form"
        novalidate
        @submit.prevent="review"
      >
        <div class="field">
          <label for="correction-amount">Valor correto</label>
          <div class="money-input">
            <span aria-hidden="true">R$</span>
            <Input
              id="correction-amount"
              v-model="amountText"
              inputmode="decimal"
              autocomplete="off"
              required
              :aria-invalid="!!err('amount')"
              :aria-describedby="
                err('amount') ? 'correction-amount-error' : undefined
              "
            />
          </div>
          <p
            v-if="err('amount')"
            id="correction-amount-error"
            class="small field-error"
          >
            {{ err('amount') }}
          </p>
        </div>
        <div class="field">
          <label for="correction-method">Forma correta</label>
          <select id="correction-method" v-model="method" class="control">
            <option
              v-for="option in paymentMethods"
              :key="option.value"
              :value="option.value"
            >
              {{ option.label }}
            </option>
          </select>
        </div>
        <div class="field">
          <label for="correction-instant">Data e hora corretas</label>
          <Input
            id="correction-instant"
            v-model="local"
            type="datetime-local"
            min="2000-01-01T00:00"
            :max="nowLocalIn(timezone)"
            required
            :aria-invalid="!!err('instant')"
            :aria-describedby="
              [
                'correction-instant-hint',
                err('instant') ? 'correction-instant-error' : '',
              ]
                .filter(Boolean)
                .join(' ')
            "
          />
          <p id="correction-instant-hint" class="small text-secondary">
            Horário de {{ timezone }}. Mudar a data move o valor para o mês
            correto no resumo.
          </p>
          <p
            v-if="err('instant')"
            id="correction-instant-error"
            class="small field-error"
          >
            {{ err('instant') }}
          </p>
        </div>
        <div class="field wide">
          <label for="correction-reason">Motivo da correção</label>
          <Textarea
            id="correction-reason"
            v-model="reason"
            maxlength="500"
            rows="3"
            :aria-invalid="!!err('reason')"
            :aria-describedby="
              err('reason') ? 'correction-reason-error' : undefined
            "
          />
          <p
            v-if="err('reason')"
            id="correction-reason-error"
            class="small field-error"
          >
            {{ err('reason') }}
          </p>
        </div>
        <DialogFooter class="wide footer">
          <Button type="button" variant="ghost" @click="close">Cancelar</Button>
          <Button type="submit"
            >Revisar correção<ArrowRight aria-hidden="true"
          /></Button>
        </DialogFooter>
      </form>

      <div v-else-if="shown && effect" class="review">
        <table class="compare">
          <caption class="sr-only">
            Valores antes e depois da correção
          </caption>
          <thead>
            <tr>
              <th scope="col"><span class="sr-only">Campo</span></th>
              <th scope="col">Antes</th>
              <th scope="col">Depois</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">Valor</th>
              <td class="tabular">{{ formatMoney(shown.amount) }}</td>
              <td class="tabular">{{ formatMoney(corrected!) }}</td>
            </tr>
            <tr>
              <th scope="row">Forma</th>
              <td>{{ methodLabel(shown.method) }}</td>
              <td>{{ methodLabel(method) }}</td>
            </tr>
            <tr>
              <th scope="row">Data e hora</th>
              <td class="tabular">
                {{ formatInstant(instantOf(shown), timezone) }}
              </td>
              <td class="tabular">
                {{ formatInstant(zonedLocalToIso(local, timezone), timezone) }}
              </td>
            </tr>
          </tbody>
        </table>
        <p class="effect" role="status">
          <strong
            >Efeito:
            {{
              toCents(effect.difference) === 0n
                ? 'nenhuma mudança de valor'
                : `${toCents(effect.difference) < 0n ? 'menos' : 'mais'} ${formatMoney(effect.difference.replace('-', ''))} ${settledWord.toLowerCase()}`
            }}.</strong
          >
          {{ settledWord }} desta parcela:
          {{ formatMoney(effect.settledBefore) }} →
          {{ formatMoney(effect.settledAfter) }}. Restante:
          {{ formatMoney(effect.remainingBefore) }} →
          {{ formatMoney(effect.remainingAfter) }}.
        </p>
        <p class="small text-secondary">Motivo: {{ reason.trim() }}</p>
        <DialogFooter class="footer">
          <Button
            type="button"
            variant="ghost"
            :disabled="saving"
            @click="close"
            >Cancelar</Button
          >
          <Button
            type="button"
            variant="outline"
            :disabled="saving"
            @click="step = 'edit'"
            ><ArrowLeft aria-hidden="true" />Voltar e editar</Button
          >
          <Button type="button" :disabled="saving" @click="confirm">{{
            saving ? 'Registrando…' : 'Confirmar correção'
          }}</Button>
        </DialogFooter>
      </div>
    </DialogContent>
  </Dialog>
</template>

<style scoped>
.correction-form {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-4);
}
.wide {
  grid-column: 1 / -1;
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
.review {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}
.compare {
  width: 100%;
  border-collapse: collapse;
}
.compare th,
.compare td {
  padding: var(--space-2) var(--space-3);
  border-bottom: 1px solid var(--color-border-subtle);
  text-align: left;
}
.compare thead th {
  font-size: var(--type-secondary);
  color: var(--color-text-secondary);
}
.effect {
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-control);
  background: var(--color-status-info-bg);
  color: var(--color-status-info-fg);
}
.conflict-line {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
}
.footer {
  flex-wrap: wrap;
  gap: var(--space-2);
}
@media (max-width: 640px) {
  .correction-form {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
