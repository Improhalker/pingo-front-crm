<script setup lang="ts">
// Forecast (card 11, ADR-033): open instalments by due date, with what was already settled and what
// remains. A sale not received appears here, never in the statement; a partial receipt splits between both.
import { RotateCcw, X } from '@lucide/vue'
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
import { methodLabel, paymentMethods, type Category } from '~/types/finance'
import type { ForecastFilters, ForecastReport } from '~/types/reports'

const props = defineProps<{ categories: Category[] }>()
const { organization, run } = useFinance()
const lane = createLatestRequest()

const empty = (): ForecastFilters => ({
  due_from: '',
  due_to: '',
  type: '',
  status: '',
  category_id: '',
  method: '',
})
const draft = ref<ForecastFilters>(empty())
const applied = ref<ForecastFilters>(empty())
const filterError = ref('')
const data = ref<ForecastReport | null>(null)
const loading = ref(false)
const error = ref('')

const categoryOptions = computed(() =>
  props.categories.filter(
    (category) =>
      !draft.value.type ||
      category.type ===
        (draft.value.type === 'receivable' ? 'REVENUE' : 'EXPENSE'),
  ),
)
const filtered = computed(() =>
  Object.values(applied.value).some((value) => value !== ''),
)
const periodText = computed(() => {
  const period = data.value?.period
  if (!period) return ''
  if (period.due_from && period.due_to)
    return `Vencimentos de ${formatCivilDate(period.due_from)} a ${formatCivilDate(period.due_to)}`
  if (period.due_from)
    return `Vencimentos a partir de ${formatCivilDate(period.due_from)}`
  if (period.due_to) return `Vencimentos até ${formatCivilDate(period.due_to)}`
  return 'Todos os vencimentos em aberto, inclusive atrasados'
})

async function load(page = 1) {
  if (!organization.value) return
  loading.value = true
  error.value = ''
  const filters = applied.value
  try {
    const result = await run(
      (api, signal) =>
        api.forecastReport(
          {
            page,
            due_from: filters.due_from || undefined,
            due_to: filters.due_to || undefined,
            type: filters.type || undefined,
            status: filters.status || undefined,
            category_id: filters.category_id || undefined,
            method: filters.method || undefined,
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
      'Não foi possível carregar o que falta receber e pagar. Tente novamente.',
    )
    loading.value = false
  }
}
function apply() {
  filterError.value = reportPeriodError(
    draft.value.due_from,
    draft.value.due_to,
  )
  if (filterError.value) return
  if (
    draft.value.category_id &&
    !categoryOptions.value.some((c) => c.id === draft.value.category_id)
  )
    draft.value.category_id = ''
  applied.value = { ...draft.value }
  return load(1)
}
function reset() {
  draft.value = empty()
  return apply()
}

watch(
  () => organization.value?.id,
  (id) => {
    lane.cancel()
    data.value = null
    error.value = ''
    filterError.value = ''
    draft.value = empty()
    applied.value = empty()
    if (id) load()
  },
  { immediate: true },
)
onBeforeUnmount(() => lane.cancel())
</script>

<template>
  <section class="report" aria-labelledby="forecast-title" :aria-busy="loading">
    <div class="report-heading">
      <h2 id="forecast-title">A receber e a pagar</h2>
      <p class="small text-secondary">
        Parcelas ainda em aberto, pela data de vencimento. Mostra o valor da
        parcela, o que já foi baixado e o que falta. Nada aqui entrou no caixa.
      </p>
    </div>

    <form
      class="filters"
      role="search"
      aria-label="Filtrar o que falta receber e pagar"
      @submit.prevent="apply"
    >
      <div class="field">
        <label for="forecast-from">Vencimento a partir de</label>
        <Input
          id="forecast-from"
          v-model="draft.due_from"
          type="date"
          min="2000-01-01"
          max="2100-12-31"
          :disabled="loading"
        />
      </div>
      <div class="field">
        <label for="forecast-to">Vencimento até</label>
        <Input
          id="forecast-to"
          v-model="draft.due_to"
          type="date"
          min="2000-01-01"
          max="2100-12-31"
          :disabled="loading"
          :aria-invalid="!!filterError"
          :aria-describedby="
            filterError ? 'forecast-filter-error' : 'forecast-hint'
          "
        />
      </div>
      <div class="field">
        <label for="forecast-type">Tipo</label>
        <select
          id="forecast-type"
          v-model="draft.type"
          class="control"
          :disabled="loading"
        >
          <option value="">A receber e a pagar</option>
          <option value="receivable">Somente a receber</option>
          <option value="payable">Somente a pagar</option>
        </select>
      </div>
      <div class="field">
        <label for="forecast-status">Situação</label>
        <select
          id="forecast-status"
          v-model="draft.status"
          class="control"
          :disabled="loading"
        >
          <option value="">Todas em aberto</option>
          <option value="pending">Pendentes (no prazo)</option>
          <option value="overdue">Atrasadas</option>
          <option value="partial">Com baixa parcial</option>
        </select>
      </div>
      <div class="field">
        <label for="forecast-category">Categoria</label>
        <select
          id="forecast-category"
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
        <label for="forecast-method">Forma prevista</label>
        <select
          id="forecast-method"
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
      <div class="filter-actions">
        <Button type="submit" variant="outline" :disabled="loading"
          >Aplicar filtros</Button
        >
        <Button
          v-if="filtered"
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
      id="forecast-filter-error"
      class="field-error small"
      role="alert"
    >
      {{ filterError }}
    </p>
    <p v-else id="forecast-hint" class="small text-secondary">
      Sem período, mostra tudo o que está em aberto, inclusive atrasos. Com
      período, até {{ STATEMENT_MAX_DAYS }} dias.
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
        basis="Previsto: restante de cada parcela pela data de vencimento"
        :timezone="data.period.timezone"
        :as-of="data.as_of"
      />
      <div class="summary-grid" aria-label="Totais do previsto filtrado">
        <section class="card indicator">
          <h3>A receber</h3>
          <p class="indicator-value tabular">
            {{ formatMoney(data.summary.receivable) }}
          </p>
          <p class="small text-secondary">
            {{ formatMoney(data.summary.overdue_receivable) }} em atraso
          </p>
        </section>
        <section class="card indicator">
          <h3>A pagar</h3>
          <p class="indicator-value tabular">
            {{ formatMoney(data.summary.payable) }}
          </p>
          <p class="small text-secondary">
            {{ formatMoney(data.summary.overdue_payable) }} em atraso
          </p>
        </section>
        <section class="card indicator">
          <h3>A receber menos a pagar</h3>
          <p class="indicator-value tabular">
            {{ formatMoney(data.summary.difference) }}
          </p>
          <p class="small text-secondary">
            Diferença dos compromissos filtrados; não é saldo de conta
          </p>
        </section>
      </div>
    </template>

    <FinanceListCard v-if="!error">
      <div v-if="loading && !data" class="list-skeleton" role="status">
        <span class="sr-only">Carregando o que falta receber e pagar…</span>
        <div v-for="row in 4" :key="row" class="list-skeleton-row">
          <Skeleton class="h-4 w-56 max-w-full" />
          <Skeleton class="h-3 w-36 max-w-full" />
        </div>
      </div>

      <div v-else-if="data && !data.data.length" class="list-empty">
        <template v-if="!data.has_entries">
          <p class="list-empty-title">Nenhum lançamento cadastrado ainda.</p>
          <p class="text-secondary">
            Registre vendas e despesas para acompanhar o que falta receber e
            pagar.
          </p>
          <Button as-child variant="outline"
            ><NuxtLink to="/despesas/nova">Registrar despesa</NuxtLink></Button
          >
        </template>
        <template v-else-if="filtered">
          <p class="list-empty-title">Nenhuma parcela encontrada.</p>
          <p class="text-secondary">
            Nenhuma parcela em aberto atende a esses filtros.
          </p>
          <Button variant="outline" @click="reset">Limpar filtros</Button>
        </template>
        <template v-else>
          <p class="list-empty-title">Nada em aberto.</p>
          <p class="text-secondary">
            Todas as parcelas registradas já foram recebidas ou pagas.
          </p>
        </template>
      </div>

      <Table v-else-if="data">
        <TableCaption class="sr-only">
          Parcelas em aberto ordenadas por vencimento, do mais antigo para o
          mais distante. Valores em reais.
        </TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>Vencimento</TableHead>
            <TableHead>Lançamento</TableHead>
            <TableHead class="numeric">Parcela</TableHead>
            <TableHead class="numeric">Já baixado</TableHead>
            <TableHead class="numeric">Restante</TableHead>
            <TableHead>Situação</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-for="item in data.data" :key="`${item.kind}-${item.id}`">
            <TableCell data-label="Vencimento" class="tabular">{{
              formatCivilDate(item.due_date)
            }}</TableCell>
            <TableHead scope="row" class="row-head">
              <span class="row-title">
                <NuxtLink
                  :to="
                    reportEntryLink(
                      item.kind === 'RECEIVABLE',
                      item.entry_id,
                      item.id,
                    )
                  "
                  class="row-name"
                  >{{ item.description }}</NuxtLink
                >
                <span class="row-meta"
                  >{{ item.kind === 'RECEIVABLE' ? 'A receber' : 'A pagar' }} ·
                  {{ item.category.name
                  }}{{ item.counterpart ? ` · ${item.counterpart}` : '' }} ·
                  {{ reportInstallmentLabel(item.installment) }} ·
                  {{ methodLabel(item.expected_method) }}</span
                >
              </span>
            </TableHead>
            <TableCell data-label="Parcela" class="numeric tabular">{{
              formatMoney(item.amount)
            }}</TableCell>
            <TableCell data-label="Já baixado" class="numeric tabular">{{
              formatMoney(item.settled_amount)
            }}</TableCell>
            <TableCell
              data-label="Restante"
              class="numeric tabular remaining"
              >{{ formatMoney(item.remaining_amount) }}</TableCell
            >
            <TableCell data-label="Situação">
              <span class="status">
                <FinanceStatusBadge :status="item.status" />
                <span
                  v-if="toCents(item.settled_amount) > 0n"
                  class="small text-secondary"
                  >baixa parcial</span
                >
              </span>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>

      <FinancePager
        v-if="data && data.data.length"
        :meta="data.meta"
        :loading="loading"
        label="Paginação do que falta receber e pagar"
        :noun="['parcela', 'parcelas']"
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
.remaining {
  font-weight: var(--weight-strong);
}
.status {
  display: inline-flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-1);
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
  .status {
    align-items: flex-end;
  }
}
</style>
