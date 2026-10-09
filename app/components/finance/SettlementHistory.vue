<script setup lang="ts">
// Receipts/payments of an entry, corrected ones included (card 09, ADR-031). A corrected row keeps its
// original values as evidence and says which row replaced it; only "Vigente" rows count in the totals.
import { Pencil } from '@lucide/vue'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/components/ui/table'
import {
  methodLabel,
  type Installment,
  type Payment,
  type Receipt,
} from '~/types/finance'

type Settlement = Receipt | Payment
const props = defineProps<{
  items: Settlement[]
  kind: 'revenue' | 'expense'
  timezone: string
  installments: Installment[]
  disabled?: boolean
}>()
const emit = defineEmits<{ correct: [item: Settlement] }>()
const noun = computed(() =>
  props.kind === 'revenue' ? 'recebimento' : 'pagamento',
)
const instant = (item: Settlement) =>
  'received_at' in item ? item.received_at : item.paid_at
const byId = computed(
  () => new Map(props.items.map((item, index) => [item.id, index + 1])),
)
const showInstallment = computed(() => props.installments.length > 1)
function installmentLabel(item: Settlement) {
  const line = props.installments.find((i) => i.id === item.installment_id)
  if (!line) return '—'
  if (line.is_down_payment) return 'Entrada'
  return `Parcela ${line.sequence - (props.installments[0]?.is_down_payment ? 1 : 0)}`
}
</script>

<template>
  <FinanceListCard>
    <Table>
      <TableCaption class="sr-only">
        {{ kind === 'revenue' ? 'Recebimentos' : 'Pagamentos' }} deste
        lançamento, do mais antigo para o mais recente, no horário da empresa.
        Linhas corrigidas são mantidas como histórico e não entram nos totais.
      </TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>{{
            kind === 'revenue' ? 'Recebido em' : 'Pago em'
          }}</TableHead>
          <TableHead v-if="showInstallment">Parcela</TableHead>
          <TableHead class="numeric">Valor</TableHead>
          <TableHead>Forma</TableHead>
          <TableHead>Registrado por</TableHead>
          <TableHead>Situação</TableHead>
          <TableHead><span class="sr-only">Ações</span></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow
          v-for="item in items"
          :key="item.id"
          :class="{ corrected: item.status === 'CORRECTED' }"
        >
          <TableHead scope="row" class="row-head tabular">
            {{ formatInstant(instant(item), timezone) }}
          </TableHead>
          <TableCell v-if="showInstallment" data-label="Parcela">{{
            installmentLabel(item)
          }}</TableCell>
          <TableCell data-label="Valor" class="numeric tabular amount">{{
            formatMoney(item.amount)
          }}</TableCell>
          <TableCell data-label="Forma">{{
            methodLabel(item.method)
          }}</TableCell>
          <TableCell data-label="Registrado por" class="stack">
            {{ item.created_by ?? '—' }}
            <span
              v-if="item.registered_at"
              class="block small text-secondary tabular"
              >em {{ formatInstant(item.registered_at, timezone) }}</span
            >
          </TableCell>
          <TableCell data-label="Situação" class="situation stack">
            <Badge v-if="item.status === 'CORRECTED'" variant="outline"
              >Corrigido</Badge
            >
            <Badge v-else-if="item.corrects_id" variant="info"
              >Correção vigente</Badge
            >
            <Badge v-else variant="success">Vigente</Badge>
            <span
              v-if="item.status === 'CORRECTED' && item.superseded_at"
              class="block small text-secondary"
              >Substituído em
              {{ formatInstant(item.superseded_at, timezone) }}
              <template v-if="item.replaced_by_id"
                >pela linha {{ byId.get(item.replaced_by_id) }}</template
              >. Não entra nos totais.</span
            >
            <span v-if="item.corrects_id" class="block small text-secondary"
              >Corrige a linha {{ byId.get(item.corrects_id) }}. Motivo:
              {{ item.correction_reason }}</span
            >
          </TableCell>
          <TableCell class="action-cell">
            <Button
              v-if="item.status === 'EFFECTIVE'"
              variant="ghost"
              size="sm"
              :disabled="disabled"
              @click="emit('correct', item)"
            >
              <Pencil aria-hidden="true" />Corrigir
              <span class="sr-only"
                >{{ noun }} de {{ formatMoney(item.amount) }} em
                {{ formatInstant(instant(item), timezone) }}</span
              >
            </Button>
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  </FinanceListCard>
</template>

<style scoped>
.block {
  display: block;
  margin-top: var(--space-1);
}
.situation {
  white-space: normal;
}
@media (min-width: 641px) {
  .situation {
    min-width: 180px;
  }
}
/* On phones each cell is a flex row: let the explanatory lines wrap under the value. */
@media (max-width: 640px) {
  .stack {
    flex-wrap: wrap;
  }
  .stack .block {
    flex-basis: 100%;
    text-align: right;
  }
}
/* Corrected rows stay readable (evidence), with the amount struck through and a written status. */
.corrected .amount {
  text-decoration: line-through;
  color: var(--color-text-secondary);
}
.action-cell {
  text-align: right;
  white-space: nowrap;
}
</style>
