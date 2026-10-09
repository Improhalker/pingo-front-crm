<script setup lang="ts">
// Schedule of a revenue/expense (card 10): down payment and instalments, each with its own due date,
// reminder, method and balance. Status is written out; settling stays an explicit action of the page.
import { HandCoins } from '@lucide/vue'
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
import { methodLabel, type Installment } from '~/types/finance'

const props = defineProps<{
  installments: Installment[]
  kind: 'revenue' | 'expense'
  selectedId?: string
  disabled?: boolean
}>()
const emit = defineEmits<{ settle: [installmentId: string] }>()
const settledLabel = computed(() =>
  props.kind === 'revenue' ? 'Recebido' : 'Pago',
)
const regular = computed(
  () => props.installments.filter((item) => !item.is_down_payment).length,
)
function label(item: Installment) {
  if (item.is_down_payment) return 'Entrada'
  const offset = props.installments[0]?.is_down_payment ? 1 : 0
  return `Parcela ${item.sequence - offset} de ${regular.value}`
}
function isOpen(item: Installment) {
  return toCents(item.remaining_amount) > 0n
}
</script>

<template>
  <FinanceListCard>
    <Table>
      <TableCaption class="sr-only">
        Entrada e parcelas deste lançamento, com vencimento, lembrete, forma
        prevista, valor {{ settledLabel.toLowerCase() }} e restante.
      </TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>Parcela</TableHead>
          <TableHead>Vencimento</TableHead>
          <TableHead>Lembrete</TableHead>
          <TableHead>Forma prevista</TableHead>
          <TableHead class="numeric">Valor</TableHead>
          <TableHead class="numeric">{{ settledLabel }}</TableHead>
          <TableHead class="numeric">Restante</TableHead>
          <TableHead>Situação</TableHead>
          <TableHead><span class="sr-only">Ações</span></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow
          v-for="item in installments"
          :key="item.id"
          :data-selected="item.id === selectedId || undefined"
        >
          <TableHead scope="row" class="row-head">{{ label(item) }}</TableHead>
          <TableCell data-label="Vencimento" class="tabular">{{
            formatCivilDate(item.due_date)
          }}</TableCell>
          <TableCell data-label="Lembrete" class="tabular">{{
            item.reminder_date ? formatCivilDate(item.reminder_date) : '—'
          }}</TableCell>
          <TableCell data-label="Forma prevista">{{
            methodLabel(item.expected_method)
          }}</TableCell>
          <TableCell data-label="Valor" class="numeric tabular">{{
            formatMoney(item.amount)
          }}</TableCell>
          <TableCell :data-label="settledLabel" class="numeric tabular">{{
            formatMoney(item.settled_amount)
          }}</TableCell>
          <TableCell data-label="Restante" class="numeric tabular">{{
            formatMoney(item.remaining_amount)
          }}</TableCell>
          <TableCell data-label="Situação"
            ><FinanceStatusBadge :status="item.status"
          /></TableCell>
          <TableCell class="action-cell">
            <Button
              v-if="isOpen(item)"
              variant="outline"
              size="sm"
              :disabled="disabled"
              @click="emit('settle', item.id)"
            >
              <HandCoins aria-hidden="true" />Registrar
              <span class="sr-only"
                >{{ kind === 'revenue' ? 'recebimento' : 'pagamento' }} da
                {{ label(item).toLowerCase() }}</span
              >
            </Button>
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  </FinanceListCard>
</template>

<style scoped>
tr[data-selected] {
  background: var(--color-brand-subtle-bg);
}
.action-cell {
  text-align: right;
  white-space: nowrap;
}
</style>
