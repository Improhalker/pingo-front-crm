<script setup lang="ts">
import { useMediaQuery } from '@vueuse/core'
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/components/ui/table'
import type { DashboardDay } from '~/types/dashboard'

const props = defineProps<{
  days: DashboardDay[]
  month: string
  timezone: string
  income: string
  expenses: string
}>()
const compact = useMediaQuery('(max-width: 640px)')
const chartWidth = computed(() => (compact.value ? 320 : 760))
const chart = computed(() =>
  projectDashboardChart(props.days, chartWidth.value),
)
const dayLabels = computed(() =>
  compact.value
    ? chart.value.points.filter(
        (_, index) =>
          index === 0 ||
          index === 10 ||
          index === 20 ||
          index === props.days.length - 1,
      )
    : chart.value.labels,
)
const titleId = useId()
const descriptionId = useId()
const monthLabel = computed(() => dashboardMonthLabel(props.month))
</script>

<template>
  <section class="card cash-chart" :aria-labelledby="titleId">
    <div class="chart-head">
      <div>
        <h2 :id="titleId">Entradas e saídas</h2>
        <p class="small text-secondary">Por dia · {{ monthLabel }}</p>
      </div>
      <ul class="legend" aria-label="Legenda do gráfico">
        <li><span class="line incoming" aria-hidden="true" />Entradas</li>
        <li><span class="line outgoing" aria-hidden="true" />Saídas</li>
      </ul>
    </div>
    <p :id="descriptionId" class="sr-only">
      Recebimentos e pagamentos efetivos, por dia no fuso {{ timezone }}.
      Entradas: {{ formatMoney(income) }}. Saídas: {{ formatMoney(expenses) }}.
      A linha contínua mostra entradas e a tracejada, saídas. Valores exatos na
      tabela abaixo.
    </p>
    <figure>
      <svg
        :viewBox="`0 0 ${chartWidth} 290`"
        role="img"
        :aria-labelledby="`${titleId} ${descriptionId}`"
      >
        <g v-for="tick in chart.ticks" :key="tick.value" class="grid">
          <line x1="94" :x2="chartWidth - 32" :y1="tick.y" :y2="tick.y" />
          <text x="80" :y="tick.y + 4" text-anchor="end">
            {{ dashboardAxisLabel(tick.value) }}
          </text>
        </g>
        <g v-for="point in dayLabels" :key="point.date" class="axis">
          <text :x="point.x" y="274" text-anchor="middle">
            {{ point.date.slice(8) }}
          </text>
        </g>
        <polyline :points="chart.expensesPath" class="series expenses" />
        <polyline :points="chart.incomePath" class="series income" />
        <g v-for="point in chart.points" :key="point.date">
          <circle
            v-if="point.income !== '0.00'"
            :cx="point.x"
            :cy="point.incomeY"
            r="4"
            class="income-point"
          >
            <title>
              {{ formatCivilDate(point.date) }} · Entrada
              {{ formatMoney(point.income) }}
            </title>
          </circle>
          <rect
            v-if="point.expenses !== '0.00'"
            :x="point.x - 3"
            :y="point.expensesY - 3"
            width="6"
            height="6"
            class="expense-point"
          >
            <title>
              {{ formatCivilDate(point.date) }} · Saída
              {{ formatMoney(point.expenses) }}
            </title>
          </rect>
        </g>
      </svg>
      <figcaption class="small text-secondary">
        {{
          chart.empty
            ? 'Nenhum recebimento ou pagamento registrado neste mês.'
            : 'Somente valores efetivamente recebidos e pagos.'
        }}
        Fuso: {{ timezone }}.
      </figcaption>
    </figure>
    <details class="daily-values">
      <summary>Ver valores por dia</summary>
      <Table>
        <TableCaption
          >Valores diários de {{ monthLabel }} · {{ timezone }}</TableCaption
        >
        <TableHeader
          ><TableRow
            ><TableHead scope="col">Dia</TableHead
            ><TableHead scope="col" class="number">Entradas</TableHead
            ><TableHead scope="col" class="number">Saídas</TableHead></TableRow
          ></TableHeader
        >
        <TableBody>
          <TableRow v-for="day in days" :key="day.date">
            <TableCell>{{ formatCivilDate(day.date) }}</TableCell>
            <TableCell class="number tabular">{{
              formatMoney(day.income)
            }}</TableCell>
            <TableCell class="number tabular">{{
              formatMoney(day.expenses)
            }}</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </details>
  </section>
</template>

<style scoped>
.cash-chart {
  min-width: 0;
}
.chart-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--space-4);
}
.chart-head p {
  margin-top: var(--space-1);
}
.legend {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-4);
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: var(--type-secondary);
}
.legend li {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}
.line {
  width: 24px;
  border-top: 3px solid var(--color-brand-subtle-fg);
}
.outgoing {
  border-color: var(--color-text-secondary);
  border-top-style: dashed;
}
figure {
  margin: var(--space-6) 0 0;
}
svg {
  display: block;
  width: 100%;
  height: auto;
  overflow: visible;
}
svg text {
  fill: var(--color-text-secondary);
  font: 12px var(--type-family);
  font-variant-numeric: tabular-nums;
}
.grid line {
  stroke: var(--color-border-subtle);
  stroke-dasharray: 4 6;
}
.series {
  fill: none;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 3;
}
.income {
  stroke: var(--color-brand-subtle-fg);
}
.expenses {
  stroke: var(--color-text-secondary);
  stroke-dasharray: 7 6;
}
.income-point {
  fill: var(--color-surface);
  stroke: var(--color-brand-subtle-fg);
  stroke-width: 2;
}
.expense-point {
  fill: var(--color-text-secondary);
}
.daily-values {
  border-top: 1px solid var(--color-border-subtle);
  margin-top: var(--space-4);
  padding-top: var(--space-3);
}
summary {
  cursor: pointer;
  font-size: var(--type-secondary);
  font-weight: var(--weight-heading);
  color: var(--color-brand-subtle-fg);
}
.number {
  text-align: right;
}
@media (max-width: 640px) {
  svg text {
    font-size: 16px;
  }
}
</style>
