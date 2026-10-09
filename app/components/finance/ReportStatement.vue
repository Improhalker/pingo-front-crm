<script setup lang="ts">
// Cash statement (card 11, ADR-033): receipts and payments actually registered, chronological, with
// totals of the whole filtered set calculated by the backend (never the visible page only).
import { RotateCcw, X } from '@lucide/vue'
import { Alert, AlertDescription } from '~/components/ui/alert'
import { Badge } from '~/components/ui/badge'
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
import { methodLabel, paymentMethods, type Category } from '~/types/finance'
import type { StatementFilters, StatementReport } from '~/types/reports'

const props = defineProps<{ categories: Category[] }>()
const { organization, timezone, run } = useFinance()
const lane = createLatestRequest()

function initial(): StatementFilters {
  const { from, to } = reportMonthBounds(todayIn(timezone.value).slice(0, 7))
  return {
    from,
    to,
    type: '',
    category_id: '',
    method: '',
    status: 'effective',
    order: 'asc',
  }
}
const draft = ref<StatementFilters>(initial())
const applied = ref<StatementFilters>(initial())
const filterError = ref('')
const data = ref<StatementReport | null>(null)
const loading = ref(false)
const error = ref('')

const categoryOptions = computed(() =>
  props.categories.filter(
    (category) =>
      !draft.value.type ||
      category.type === (draft.value.type === 'income' ? 'REVENUE' : 'EXPENSE'),
  ),
)
const customized = computed(() => {
  const base = initial()
  return (Object.keys(base) as (keyof StatementFilters)[]).some(
    (key) => applied.value[key] !== base[key],
  )
})
const tone = computed(() =>
  data.value ? reportToneOf(data.value.summary.result) : 'zero',
)
const periodText = computed(() =>
  data.value
    ? `${formatCivilDate(data.value.period.starts_on)} a ${formatCivilDate(data.value.period.ends_on)}`
    : '',
)

async function load(page = 1) {
  if (!organization.value) return
  loading.value = true
  error.value = ''
  const filters = applied.value
  try {
    const result = await run(
      (api, signal) =>
        api.statementReport(
          {
            page,
            from: filters.from,
            to: filters.to,
            type: filters.type || undefined,
            category_id: filters.category_id || undefined,
            method: filters.method || undefined,
            status: filters.status,
            order: filters.order,
          },
          signal,
        ),
      lane.begin(),
    )
    if (!result.ok) return
    data.value = result.value
    loading.value = false
  } catch (cause) {
    error.value = financeErrorMessage(
      cause,
      'Não foi possível carregar o extrato. Tente novamente.',
    )
    loading.value = false
  }
}
function apply() {
  filterError.value = ''
  if (!draft.value.from || !draft.value.to) {
    filterError.value = 'Informe o início e o fim do período.'
    return
  }
  filterError.value = reportPeriodError(draft.value.from, draft.value.to)
  if (filterError.value) return
  // A category of the other type would hide every row; drop it when the type changes.
  if (
    draft.value.category_id &&
    !categoryOptions.value.some((c) => c.id === draft.value.category_id)
  )
    draft.value.category_id = ''
  applied.value = { ...draft.value }
  return load(1)
}
function reset() {
  draft.value = initial()
  return apply()
}

watch(
  () => organization.value?.id,
  (id) => {
    lane.cancel()
    data.value = null
    error.value = ''
    filterError.value = ''
    draft.value = initial()
    applied.value = initial()
    if (id) load()
  },
  { immediate: true },
)
onBeforeUnmount(() => lane.cancel())
</script>

<template>
  <section
    class="report"
    aria-labelledby="statement-title"
    :aria-busy="loading"
  >
    <div class="report-heading">
      <h2 id="statement-title">Extrato do realizado</h2>
      <p class="small text-secondary">
        Recebimentos e pagamentos registrados, na ordem em que aconteceram.
        Vendas e despesas ainda não baixadas ficam em “A receber e a pagar”.
      </p>
    </div>

    <form
      class="filters"
      role="search"
      aria-label="Filtrar o extrato"
      @submit.prevent="apply"
    >
      <div class="field">
        <label for="statement-from">De</label>
        <Input
          id="statement-from"
          v-model="draft.from"
          type="date"
          min="2000-01-01"
          max="2100-12-31"
          required
          :disabled="loading"
        />
      </div>
      <div class="field">
        <label for="statement-to">Até</label>
        <Input
          id="statement-to"
          v-model="draft.to"
          type="date"
          min="2000-01-01"
          max="2100-12-31"
          required
          :disabled="loading"
          :aria-invalid="!!filterError"
          :aria-describedby="
            filterError ? 'statement-filter-error' : 'statement-period-hint'
          "
        />
      </div>
      <div class="field">
        <label for="statement-type">Tipo</label>
        <select
          id="statement-type"
          v-model="draft.type"
          class="control"
          :disabled="loading"
        >
          <option value="">Entradas e saídas</option>
          <option value="income">Somente entradas</option>
          <option value="expense">Somente saídas</option>
        </select>
      </div>
      <div class="field">
        <label for="statement-category">Categoria</label>
        <select
          id="statement-category"
          v-model="draft.category_id"
          class="control"
          :disabled="loading"
        >
          <option value="">Todas</option>
          <option
            v-for="category in categoryOptions"
            :key="category.id"
            :value="category.id"
          >
            {{ category.name }} ·
            {{ category.type === 'REVENUE' ? 'receita' : 'despesa'
            }}{{ category.archived ? ' (arquivada)' : '' }}
          </option>
        </select>
      </div>
      <div class="field">
        <label for="statement-method">Forma</label>
        <select
          id="statement-method"
          v-model="draft.method"
          class="control"
          :disabled="loading"
        >
          <option value="">Todas</option>
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
        <label for="statement-status">Situação da baixa</label>
        <select
          id="statement-status"
          v-model="draft.status"
          class="control"
          :disabled="loading"
        >
          <option value="effective">Vigentes</option>
          <option value="corrected">Corrigidas (substituídas)</option>
          <option value="all">Vigentes e corrigidas</option>
        </select>
      </div>
      <div class="field">
        <label for="statement-order">Ordem</label>
        <select
          id="statement-order"
          v-model="draft.order"
          class="control"
          :disabled="loading"
        >
          <option value="asc">Mais antigas primeiro</option>
          <option value="desc">Mais recentes primeiro</option>
        </select>
      </div>
      <div class="filter-actions">
        <Button type="submit" variant="outline" :disabled="loading"
          >Aplicar filtros</Button
        >
        <Button
          v-if="customized"
          type="button"
          variant="ghost"
          :disabled="loading"
          @click="reset"
          ><X />Limpar filtros</Button
        >
      </div>
    </form>
    <p
      v-if="filterError"
      id="statement-filter-error"
      class="field-error small"
      role="alert"
    >
      {{ filterError }}
    </p>
    <p v-else id="statement-period-hint" class="small text-secondary">
      Até {{ STATEMENT_MAX_DAYS }} dias por consulta. Baixas corrigidas aparecem
      só para conferência e nunca entram nos totais.
    </p>

    <Alert v-if="error" variant="destructive" role="alert">
      <AlertDescription class="error-line">
        {{ error }}
        <Button
          variant="outline"
          size="sm"
          @click="load(data?.meta.current_page ?? 1)"
          ><RotateCcw />Tentar novamente</Button
        >
      </AlertDescription>
    </Alert>

    <template v-if="data && !error">
      <FinanceReportBasis
        :period="periodText"
        basis="Caixa: data e hora efetivas de cada baixa, no fuso da empresa"
        :timezone="data.period.timezone"
        :as-of="data.as_of"
      />
      <div class="summary-grid" aria-label="Totais do extrato filtrado">
        <section class="card indicator">
          <h3>Entradas</h3>
          <p class="indicator-value tabular">
            {{ formatMoney(data.summary.income) }}
          </p>
        </section>
        <section class="card indicator">
          <h3>Saídas</h3>
          <p class="indicator-value tabular">
            {{ formatMoney(data.summary.expenses) }}
          </p>
        </section>
        <section class="card indicator result" :class="tone">
          <h3>Resultado</h3>
          <p class="indicator-value tabular">
            {{ formatMoney(data.summary.result) }}
          </p>
          <p class="small font-bold">
            {{ reportResultLabel(data.summary.result) }} ·
            {{ data.summary.effective_count }}
            {{
              data.summary.effective_count === 1
                ? 'baixa vigente'
                : 'baixas vigentes'
            }}
          </p>
        </section>
      </div>
      <p class="small text-secondary">
        Totais de todas as baixas que atendem aos filtros, não apenas desta
        página.
      </p>
    </template>

    <FinanceListCard v-if="!error">
      <div v-if="loading && !data" class="list-skeleton" role="status">
        <span class="sr-only">Carregando o extrato…</span>
        <div v-for="row in 4" :key="row" class="list-skeleton-row">
          <Skeleton class="h-4 w-56 max-w-full" />
          <Skeleton class="h-3 w-36 max-w-full" />
        </div>
      </div>

      <div v-else-if="data && !data.data.length" class="list-empty">
        <template v-if="!data.has_entries">
          <p class="list-empty-title">Nenhum lançamento cadastrado ainda.</p>
          <p class="text-secondary">
            O extrato mostra recebimentos e pagamentos registrados no PingoFin.
          </p>
          <Button as-child variant="outline"
            ><NuxtLink to="/receitas/nova">Registrar receita</NuxtLink></Button
          >
        </template>
        <template v-else>
          <p class="list-empty-title">Nenhum movimento encontrado.</p>
          <p class="text-secondary">
            Não há baixas registradas que atendam a esse período e filtros.
          </p>
          <Button v-if="customized" variant="outline" @click="reset"
            >Limpar filtros</Button
          >
        </template>
      </div>

      <Table v-else-if="data">
        <TableCaption class="sr-only">
          Extrato de {{ periodText }}, em ordem
          {{ applied.order === 'asc' ? 'cronológica' : 'cronológica inversa' }}.
          Valores em reais; entradas com sinal de mais e saídas com sinal de
          menos.
        </TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>Data</TableHead>
            <TableHead>Lançamento</TableHead>
            <TableHead>Forma</TableHead>
            <TableHead class="numeric">Valor</TableHead>
            <TableHead>Situação</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow
            v-for="item in data.data"
            :key="`${item.kind}-${item.id}`"
            :class="{ corrected: item.status === 'CORRECTED' }"
          >
            <TableCell data-label="Data" class="tabular when">
              {{ formatInstant(item.occurred_at, data.period.timezone) }}
            </TableCell>
            <TableHead scope="row" class="row-head">
              <span class="row-title">
                <NuxtLink
                  :to="
                    reportEntryLink(
                      item.kind === 'INCOME',
                      item.entry_id,
                      item.installment_id,
                    )
                  "
                  class="row-name"
                  >{{ item.description }}</NuxtLink
                >
                <span class="row-meta"
                  >{{ item.kind === 'INCOME' ? 'Recebimento' : 'Pagamento' }} ·
                  {{ item.category.name
                  }}{{ item.counterpart ? ` · ${item.counterpart}` : '' }} ·
                  {{ reportInstallmentLabel(item.installment) }}</span
                >
              </span>
            </TableHead>
            <TableCell data-label="Forma">{{
              methodLabel(item.method)
            }}</TableCell>
            <TableCell
              data-label="Valor"
              class="numeric tabular amount"
              :class="item.kind === 'INCOME' ? 'in' : 'out'"
            >
              {{ item.kind === 'INCOME' ? '+' : '−' }}
              {{ formatMoney(item.amount) }}
            </TableCell>
            <TableCell data-label="Situação">
              <Badge v-if="item.status === 'CORRECTED'" variant="warning"
                >Corrigida · fora dos totais</Badge
              >
              <Badge v-else-if="item.is_correction" variant="info"
                >Correção vigente</Badge
              >
              <Badge v-else variant="success">Vigente</Badge>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>

      <FinancePager
        v-if="data && data.data.length"
        :meta="data.meta"
        :loading="loading"
        label="Paginação do extrato"
        :noun="['baixa', 'baixas']"
        @go="load"
      />
    </FinanceListCard>
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
  max-width: 72ch;
}
.filters {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  align-items: end;
  gap: var(--space-3);
}
.filter-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}
.error-line {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--space-3);
}
.summary-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-4);
}
.indicator h3 {
  font-size: var(--type-secondary);
  font-weight: var(--weight-heading);
}
.indicator-value {
  font-size: var(--type-indicator);
  font-weight: var(--weight-strong);
  margin: var(--space-2) 0 var(--space-1);
  overflow-wrap: anywhere;
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
.when {
  white-space: nowrap;
}
.amount {
  font-weight: var(--weight-strong);
}
.amount.in {
  color: var(--color-status-success-fg);
}
.corrected .amount {
  color: var(--color-text-secondary);
  text-decoration: line-through;
}
@media (min-width: 641px) {
  .report :deep(.row-head) {
    min-width: 220px;
  }
}
@media (max-width: 1000px) {
  .summary-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
@media (max-width: 640px) {
  .filters {
    grid-template-columns: minmax(0, 1fr);
  }
  .filter-actions > * {
    flex: 1;
  }
  .when {
    white-space: normal;
  }
}
</style>
