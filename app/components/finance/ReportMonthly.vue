<script setup lang="ts">
// Monthly report (card 11, ADR-033): cash result per month (same rule as the dashboard), comparison with
// the previous month, sales by sale date, expenses by due date and cash by category. Numbers come exact
// from the backend; this component only formats them.
import { ArrowDown, ArrowUp, Equal, RotateCcw } from '@lucide/vue'
import { Alert, AlertDescription } from '~/components/ui/alert'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Skeleton } from '~/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/components/ui/table'
import type { MonthlyReport } from '~/types/reports'

const { organization, timezone, run } = useFinance()
const lane = createLatestRequest()
const current = computed(() => todayIn(timezone.value).slice(0, 7))
const from = ref(reportShiftMonth(current.value, -5))
const to = ref(current.value)
const rangeError = ref('')
const data = ref<MonthlyReport | null>(null)
const loading = ref(false)
const error = ref('')

const totalsTone = computed(() =>
  data.value ? reportToneOf(data.value.totals.result) : 'zero',
)
const quiet = computed(
  () =>
    !!data.value &&
    data.value.months.every(
      (row) =>
        toCents(row.income) === 0n &&
        toCents(row.expenses) === 0n &&
        toCents(row.sold) === 0n &&
        toCents(row.expenses_due) === 0n,
    ),
)
const periodText = computed(() =>
  data.value
    ? data.value.period.from === data.value.period.to
      ? dashboardMonthLabel(data.value.period.from)
      : `${dashboardMonthLabel(data.value.period.from)} a ${dashboardMonthLabel(data.value.period.to)}`
    : '',
)

async function load() {
  if (!organization.value) return
  loading.value = true
  error.value = ''
  try {
    const result = await run(
      (api, signal) =>
        api.monthlyReport({ from: from.value, to: to.value }, signal),
      lane.begin(),
    )
    if (!result.ok) return
    data.value = result.value.data
    loading.value = false
  } catch (cause) {
    error.value = financeErrorMessage(
      cause,
      'Não foi possível carregar o relatório mensal. Tente novamente.',
    )
    loading.value = false
  }
}
function apply() {
  rangeError.value = reportMonthRangeError(from.value, to.value)
  if (rangeError.value) return
  return load()
}
function lastMonths(count: number) {
  to.value = current.value
  from.value = reportShiftMonth(current.value, 1 - count)
  return apply()
}

watch(
  () => organization.value?.id,
  (id) => {
    lane.cancel()
    data.value = null
    error.value = ''
    rangeError.value = ''
    from.value = reportShiftMonth(current.value, -5)
    to.value = current.value
    if (id) load()
  },
  { immediate: true },
)
onBeforeUnmount(() => lane.cancel())
</script>

<template>
  <section class="report" aria-labelledby="monthly-title" :aria-busy="loading">
    <div class="report-heading">
      <h2 id="monthly-title">Resultado mês a mês</h2>
      <p class="small text-secondary">
        Entradas e saídas pela data em que o dinheiro foi recebido ou pago. Até
        {{ MONTHLY_MAX_MONTHS }} meses por consulta.
      </p>
    </div>

    <form
      class="filters"
      aria-label="Período do relatório mensal"
      @submit.prevent="apply"
    >
      <div class="field">
        <label for="monthly-from">Mês inicial</label>
        <Input
          id="monthly-from"
          v-model="from"
          type="month"
          min="2000-01"
          max="2100-12"
          required
          :disabled="loading"
        />
      </div>
      <div class="field">
        <label for="monthly-to">Mês final</label>
        <Input
          id="monthly-to"
          v-model="to"
          type="month"
          min="2000-01"
          max="2100-12"
          required
          :disabled="loading"
          :aria-invalid="!!rangeError"
          :aria-describedby="rangeError ? 'monthly-range-error' : undefined"
        />
      </div>
      <Button type="submit" variant="outline" :disabled="loading"
        >Aplicar período</Button
      >
      <Button
        type="button"
        variant="ghost"
        :disabled="loading"
        @click="lastMonths(6)"
        >Últimos 6 meses</Button
      >
      <Button
        type="button"
        variant="ghost"
        :disabled="loading"
        @click="lastMonths(12)"
        >Últimos 12 meses</Button
      >
    </form>
    <p
      v-if="rangeError"
      id="monthly-range-error"
      class="field-error small"
      role="alert"
    >
      {{ rangeError }}
    </p>

    <div v-if="loading && !data" class="report-loading" role="status">
      <span class="sr-only">Carregando o relatório mensal…</span>
      <div class="summary-grid">
        <div v-for="i in 3" :key="i" class="card">
          <Skeleton class="h-4 w-24" /><Skeleton
            class="mt-4 h-8 w-40 max-w-full"
          />
        </div>
      </div>
      <Skeleton class="h-56 w-full" />
    </div>

    <Alert v-else-if="error" variant="destructive" role="alert">
      <AlertDescription class="error-line">
        {{ error }}
        <Button variant="outline" size="sm" @click="load"
          ><RotateCcw />Tentar novamente</Button
        >
      </AlertDescription>
    </Alert>

    <template v-else-if="data">
      <FinanceReportBasis
        :period="periodText"
        basis="Caixa: recebimentos e pagamentos efetivos, pelo dia local da baixa"
        :timezone="data.period.timezone"
        :as-of="data.as_of"
      />

      <div v-if="!data.has_entries" class="card empty">
        <p class="empty-title">Nenhum lançamento cadastrado ainda.</p>
        <p class="text-secondary">
          Os relatórios usam as receitas, despesas e baixas registradas no
          PingoFin. Registre a primeira para começar.
        </p>
        <div class="empty-actions">
          <Button as-child variant="outline"
            ><NuxtLink to="/receitas/nova">Registrar receita</NuxtLink></Button
          >
          <Button as-child variant="outline"
            ><NuxtLink to="/despesas/nova">Registrar despesa</NuxtLink></Button
          >
        </div>
      </div>

      <template v-else>
        <p v-if="quiet" class="card empty" role="status">
          <span class="empty-title">Nenhum movimento neste período.</span>
          <span class="text-secondary"
            >Não há vendas, despesas ou baixas registradas entre
            {{ periodText }}. Escolha outro período.</span
          >
        </p>

        <div class="summary-grid" aria-label="Totais do período">
          <section class="card indicator">
            <h3>Entradas</h3>
            <p class="indicator-value tabular">
              {{ formatMoney(data.totals.income) }}
            </p>
            <p class="small text-secondary">Recebimentos efetivos</p>
          </section>
          <section class="card indicator">
            <h3>Saídas</h3>
            <p class="indicator-value tabular">
              {{ formatMoney(data.totals.expenses) }}
            </p>
            <p class="small text-secondary">Pagamentos efetivos</p>
          </section>
          <section class="card indicator result" :class="totalsTone">
            <h3>Resultado do período</h3>
            <p class="indicator-value tabular">
              <ArrowUp v-if="totalsTone === 'positive'" aria-hidden="true" />
              <ArrowDown
                v-else-if="totalsTone === 'negative'"
                aria-hidden="true"
              />
              <Equal v-else aria-hidden="true" />{{
                formatMoney(data.totals.result)
              }}
            </p>
            <p class="small font-bold">
              Resultado
              {{ reportResultLabel(data.totals.result).toLowerCase() }}
            </p>
          </section>
        </div>
        <div
          class="summary-grid two"
          aria-label="Valores que ainda não são caixa"
        >
          <section class="card indicator secondary">
            <h3>Vendido</h3>
            <p class="indicator-value small-value tabular">
              {{ formatMoney(data.totals.sold) }}
            </p>
            <p class="small text-secondary">
              Total das vendas pela data da venda, recebidas ou não
            </p>
          </section>
          <section class="card indicator secondary">
            <h3>Despesas que vencem</h3>
            <p class="indicator-value small-value tabular">
              {{ formatMoney(data.totals.expenses_due) }}
            </p>
            <p class="small text-secondary">
              Parcelas de despesas pela data de vencimento, pagas ou não
            </p>
          </section>
        </div>

        <FinanceListCard>
          <Table>
            <TableCaption class="caption">
              Comparação mês a mês. Entradas, saídas e resultado pelo dia local
              da baixa; vendido pela data da venda; despesas pelo vencimento.
              Valores em reais.
            </TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>Mês</TableHead>
                <TableHead class="numeric">Entradas</TableHead>
                <TableHead class="numeric">Saídas</TableHead>
                <TableHead class="numeric">Resultado</TableHead>
                <TableHead>Comparação</TableHead>
                <TableHead class="numeric">Vendido</TableHead>
                <TableHead class="numeric">Despesas que vencem</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-for="row in data.months" :key="row.month">
                <TableHead scope="row" class="row-head">
                  <span class="row-name month">{{
                    dashboardMonthLabel(row.month)
                  }}</span>
                </TableHead>
                <TableCell data-label="Entradas" class="numeric tabular">{{
                  formatMoney(row.income)
                }}</TableCell>
                <TableCell data-label="Saídas" class="numeric tabular">{{
                  formatMoney(row.expenses)
                }}</TableCell>
                <TableCell data-label="Resultado" class="numeric tabular">
                  <span class="tone" :class="reportToneOf(row.result)">
                    {{ formatMoney(row.result) }}
                    <span class="tone-label">{{
                      reportResultLabel(row.result)
                    }}</span>
                  </span>
                </TableCell>
                <TableCell data-label="Comparação" class="change">{{
                  reportChangeLabel(row.result_change)
                }}</TableCell>
                <TableCell data-label="Vendido" class="numeric tabular">{{
                  formatMoney(row.sold)
                }}</TableCell>
                <TableCell
                  data-label="Despesas que vencem"
                  class="numeric tabular"
                  >{{ formatMoney(row.expenses_due) }}</TableCell
                >
              </TableRow>
            </TableBody>
          </Table>
        </FinanceListCard>

        <div class="category-grid">
          <section
            v-for="block in [
              {
                id: 'income',
                title: 'Entradas por categoria',
                items: data.categories.income,
                total: data.totals.income,
                empty: 'Nenhum recebimento no período.',
              },
              {
                id: 'expenses',
                title: 'Saídas por categoria',
                items: data.categories.expenses,
                total: data.totals.expenses,
                empty: 'Nenhum pagamento no período.',
              },
            ]"
            :key="block.id"
            class="card categories"
            :aria-labelledby="`categories-${block.id}`"
          >
            <h3 :id="`categories-${block.id}`">{{ block.title }}</h3>
            <p class="small text-secondary">
              Total {{ formatMoney(block.total) }} · caixa do período ·
              percentuais truncados em duas casas
            </p>
            <p v-if="!block.items.length" class="text-secondary">
              {{ block.empty }}
            </p>
            <ul v-else class="category-list">
              <li v-for="item in block.items" :key="item.id">
                <div class="category-line">
                  <span class="category-name"
                    >{{ item.name
                    }}<span v-if="item.archived" class="small text-secondary">
                      (arquivada)</span
                    ></span
                  >
                  <span class="tabular category-amount"
                    >{{ formatMoney(item.amount) }} ·
                    {{ reportShareLabel(item.share_bp) }}</span
                  >
                </div>
                <div class="bar" aria-hidden="true">
                  <span
                    :class="block.id"
                    :style="{ width: `${Math.max(item.share_bp / 100, 1)}%` }"
                  />
                </div>
                <span class="small text-secondary"
                  >{{ item.movements }}
                  {{ item.movements === 1 ? 'baixa' : 'baixas' }}</span
                >
              </li>
            </ul>
          </section>
        </div>
      </template>
      <p class="small text-secondary">
        Mostra somente o que foi registrado no PingoFin. Não representa o saldo
        da conta bancária nem movimentos que não foram lançados.
      </p>
    </template>
  </section>
</template>

<style scoped>
.report {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}
.report-heading {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}
.filters {
  display: flex;
  align-items: flex-end;
  flex-wrap: wrap;
  gap: var(--space-3);
}
.error-line {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--space-3);
}
.report-loading {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}
.summary-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-4);
}
.summary-grid.two {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
.indicator h3,
.categories h3 {
  font-size: var(--type-secondary);
  font-weight: var(--weight-heading);
}
.indicator-value {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--type-indicator);
  font-weight: var(--weight-strong);
  margin: var(--space-2) 0 var(--space-1);
  overflow-wrap: anywhere;
}
.indicator-value.small-value {
  font-size: var(--type-section);
}
.indicator-value svg {
  flex: none;
  width: 20px;
  height: 20px;
}
.result {
  background: var(--color-surface-secondary);
}
.result.positive {
  background: var(--color-status-success-bg);
  color: var(--color-status-success-fg);
  border-color: var(--color-status-success-fg);
}
.result.negative {
  background: var(--color-status-danger-bg);
  color: var(--color-status-danger-fg);
  border-color: var(--color-status-danger-fg);
}
.empty {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.empty-title {
  font-weight: var(--weight-strong);
}
.empty-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin-top: var(--space-2);
}
.caption {
  padding: var(--space-3) var(--space-6);
  text-align: left;
}
.tone {
  display: inline-flex;
  flex-direction: column;
  align-items: flex-end;
  font-weight: var(--weight-strong);
}
.tone.positive {
  color: var(--color-status-success-fg);
}
.tone.negative {
  color: var(--color-status-danger-fg);
}
.tone-label {
  font-size: var(--type-secondary);
  font-weight: var(--weight-normal);
}
.month {
  white-space: nowrap;
}
.change {
  color: var(--color-text-secondary);
  font-size: var(--type-secondary);
  white-space: normal;
}
.category-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-4);
}
.categories {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.category-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  margin-top: var(--space-2);
}
.category-list li {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}
.category-line {
  display: flex;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--space-1) var(--space-3);
}
.category-name {
  font-weight: var(--weight-heading);
  overflow-wrap: anywhere;
}
.category-amount {
  white-space: nowrap;
}
.bar {
  height: 8px;
  border-radius: 999px;
  background: var(--color-surface-secondary);
  overflow: hidden;
}
.bar span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--color-action-primary-bg);
}
.bar span.expenses {
  background: var(--color-text-secondary);
}
@media (max-width: 1000px) {
  .summary-grid,
  .category-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
@media (max-width: 640px) {
  .summary-grid.two {
    grid-template-columns: minmax(0, 1fr);
  }
  .filters,
  .filters .field,
  .filters > button {
    width: 100%;
  }
  .tone {
    align-items: flex-end;
  }
}
</style>
