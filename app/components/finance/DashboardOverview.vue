<script setup lang="ts">
import {
  ArrowDownLeft,
  ArrowUp,
  ArrowDown,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  CirclePlus,
  Equal,
  RefreshCw,
} from '@lucide/vue'
import { Alert, AlertDescription } from '~/components/ui/alert'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Skeleton } from '~/components/ui/skeleton'
import type { Dashboard } from '~/types/dashboard'

defineProps<{ firstName: string }>()
const { organization, timezone, run } = useFinance()
const lane = createLatestRequest()
const data = ref<Dashboard | null>(null)
const resultTone = computed(() => {
  if (!data.value) return null
  const cents = toCents(data.value.monthly.result)
  return cents > 0n ? 'positive' : cents < 0n ? 'negative' : 'zero'
})
const resultLabel = computed(() =>
  resultTone.value === 'positive'
    ? 'Resultado positivo'
    : resultTone.value === 'negative'
      ? 'Resultado negativo'
      : 'Resultado zerado',
)
const loading = ref(false)
const error = ref('')
const month = ref(todayIn(timezone.value).slice(0, 7))
const monthDraft = ref(month.value)
const monthError = ref('')
const monthLabel = computed(() => dashboardMonthLabel(month.value))

async function load() {
  if (!organization.value) return
  data.value = null
  loading.value = true
  error.value = ''
  try {
    const result = await run(
      (api, signal) => api.dashboard(month.value, signal),
      lane.begin(),
    )
    if (!result.ok) return
    data.value = result.value.data
    loading.value = false
  } catch (cause) {
    error.value = financeErrorMessage(
      cause,
      'Não foi possível carregar o resumo financeiro. Tente novamente.',
    )
    loading.value = false
  }
}
function applyMonth() {
  if (!/^(20\d{2}|2100)-(0[1-9]|1[0-2])$/.test(monthDraft.value)) {
    monthError.value =
      'Escolha um mês entre janeiro de 2000 e dezembro de 2100.'
    return
  }
  monthError.value = ''
  month.value = monthDraft.value
  load()
}
function shiftMonth(offset: number) {
  monthDraft.value = shiftDashboardMonth(month.value, offset)
  applyMonth()
}
function currentMonth() {
  monthDraft.value = todayIn(timezone.value).slice(0, 7)
  applyMonth()
}
watch(
  () => organization.value?.id,
  (id) => {
    lane.cancel()
    data.value = null
    loading.value = false
    error.value = ''
    monthError.value = ''
    month.value = todayIn(timezone.value).slice(0, 7)
    monthDraft.value = month.value
    if (id) load()
  },
  { immediate: true, flush: 'sync' },
)
onBeforeUnmount(() => lane.cancel())
</script>

<template>
  <div class="dashboard">
    <section class="dashboard-intro">
      <div>
        <p class="greeting text-secondary">Olá, {{ firstName }}.</p>
        <h2>Seu financeiro, de perto</h2>
        <p class="small text-secondary">
          Acompanhe o que entrou, o que saiu e o que ainda precisa de atenção.
        </p>
      </div>
      <div class="quick-actions">
        <Button as-child variant="outline"
          ><NuxtLink to="/despesas/nova"
            ><CirclePlus />Nova despesa</NuxtLink
          ></Button
        >
        <Button as-child
          ><NuxtLink to="/receitas/nova"
            ><CirclePlus />Nova receita</NuxtLink
          ></Button
        >
      </div>
    </section>

    <section class="period-bar" aria-label="Período do resumo">
      <div>
        <p class="period-title">{{ monthLabel }}</p>
        <p class="small text-secondary">
          Recebido e pago no mês · {{ timezone }}
        </p>
      </div>
      <form class="month-controls" @submit.prevent="applyMonth">
        <div class="month-input">
          <label for="dashboard-month" class="small">Mês de referência</label>
          <div class="month-navigation">
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Mês anterior"
              :disabled="month === '2000-01'"
              @click="shiftMonth(-1)"
              ><ChevronLeft
            /></Button>
            <Input
              id="dashboard-month"
              v-model="monthDraft"
              type="month"
              min="2000-01"
              max="2100-12"
              :aria-invalid="!!monthError"
              :aria-describedby="
                monthError ? 'dashboard-month-error' : undefined
              "
              @change="applyMonth"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Próximo mês"
              :disabled="month === '2100-12'"
              @click="shiftMonth(1)"
              ><ChevronRight
            /></Button>
          </div>
        </div>
        <Button type="button" variant="ghost" @click="currentMonth"
          >Mês atual</Button
        >
        <Button
          type="button"
          variant="outline"
          :disabled="loading"
          @click="load"
          ><RefreshCw />Atualizar</Button
        >
      </form>
      <p
        v-if="monthError"
        id="dashboard-month-error"
        class="field-error"
        role="alert"
      >
        {{ monthError }}
      </p>
    </section>

    <div
      v-if="loading"
      class="dashboard-loading"
      role="status"
      aria-live="polite"
    >
      <span class="sr-only">Carregando o resumo de {{ monthLabel }}…</span>
      <div class="monthly-grid">
        <div v-for="i in 3" :key="i" class="card">
          <Skeleton class="h-4 w-24" /><Skeleton
            class="mt-4 h-8 w-44 max-w-full"
          /><Skeleton class="mt-4 h-4 w-36" />
        </div>
      </div>
      <div class="pending-grid">
        <div v-for="i in 2" :key="i" class="card">
          <Skeleton class="h-4 w-24" /><Skeleton
            class="mt-4 h-8 w-44 max-w-full"
          />
        </div>
      </div>
      <div class="card">
        <Skeleton class="h-6 w-56 max-w-full" /><Skeleton
          class="mt-6 h-56 w-full"
        />
      </div>
    </div>
    <Alert v-else-if="error" variant="destructive" role="alert">
      <AlertDescription
        >{{ error }}
        <div class="mt-3">
          <Button variant="outline" @click="load">Tentar novamente</Button>
        </div></AlertDescription
      >
    </Alert>

    <template v-else-if="data">
      <div class="monthly-grid" aria-label="Movimentações do mês selecionado">
        <section class="card indicator" aria-labelledby="dashboard-income">
          <div class="indicator-label">
            <h3 id="dashboard-income">Entradas</h3>
            <span class="indicator-icon"><ArrowDownLeft :size="19" /></span>
          </div>
          <p class="indicator-value tabular">
            {{ formatMoney(data.monthly.income) }}
          </p>
          <p class="small text-secondary">Recebimentos efetivos no mês</p>
        </section>
        <section class="card indicator" aria-labelledby="dashboard-expenses">
          <div class="indicator-label">
            <h3 id="dashboard-expenses">Saídas</h3>
            <span class="indicator-icon neutral"
              ><ArrowUpRight :size="19"
            /></span>
          </div>
          <p class="indicator-value tabular">
            {{ formatMoney(data.monthly.expenses) }}
          </p>
          <p class="small text-secondary">Pagamentos efetivos no mês</p>
        </section>
        <section
          class="card indicator result"
          :class="resultTone"
          aria-labelledby="dashboard-result"
        >
          <div class="indicator-label">
            <h3 id="dashboard-result">Resultado do mês</h3>
            <span class="indicator-icon" aria-hidden="true"
              ><ArrowUp v-if="resultTone === 'positive'" :size="19" /><ArrowDown
                v-else-if="resultTone === 'negative'"
                :size="19" /><Equal v-else :size="19"
            /></span>
          </div>
          <p class="indicator-value tabular">
            {{ formatMoney(data.monthly.result) }}
          </p>
          <p class="small font-bold">{{ resultLabel }}</p>
          <p class="small">Entradas menos saídas</p>
        </section>
      </div>

      <section aria-labelledby="outstanding-title">
        <div class="outstanding-heading">
          <h2 id="outstanding-title">Pendências gerais</h2>
          <p class="small text-secondary">
            Todos os vencimentos · inclui atrasos
          </p>
        </div>
        <div class="pending-grid">
          <section class="card pending" aria-labelledby="dashboard-receivable">
            <div>
              <h3 id="dashboard-receivable">A receber</h3>
              <p class="indicator-value tabular">
                {{ formatMoney(data.outstanding.receivable) }}
              </p>
              <p class="small text-secondary">
                {{ formatMoney(data.outstanding.overdue_receivable) }} em atraso
              </p>
            </div>
            <NuxtLink to="/receitas" class="indicator-link"
              >Ver receitas<ArrowUpRight :size="16"
            /></NuxtLink>
          </section>
          <section class="card pending" aria-labelledby="dashboard-payable">
            <div>
              <h3 id="dashboard-payable">A pagar</h3>
              <p class="indicator-value tabular">
                {{ formatMoney(data.outstanding.payable) }}
              </p>
              <p class="small text-secondary">
                {{ formatMoney(data.outstanding.overdue_payable) }} em atraso
              </p>
            </div>
            <NuxtLink to="/despesas" class="indicator-link"
              >Ver despesas<ArrowUpRight :size="16"
            /></NuxtLink>
          </section>
        </div>
      </section>

      <FinanceDashboardChart
        :days="data.daily"
        :month="data.period.month"
        :timezone="data.period.timezone"
        :income="data.monthly.income"
        :expenses="data.monthly.expenses"
      />
      <div class="due-grid">
        <FinanceDashboardDue
          :list="data.due.overdue"
          overdue
          :today="data.today"
          :until="data.due.upcoming_until"
        />
        <FinanceDashboardDue
          :list="data.due.upcoming"
          :today="data.today"
          :until="data.due.upcoming_until"
        />
      </div>
      <p class="small text-secondary updated-at">
        Consultado em {{ formatInstant(data.as_of, data.period.timezone) }}. Use
        Atualizar após registrar uma baixa em outra aba.
      </p>
    </template>
  </div>
</template>

<style scoped>
.dashboard,
.dashboard-loading {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}
.dashboard-intro {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  flex-wrap: wrap;
}
.dashboard-intro h2 {
  font-size: var(--type-indicator);
  letter-spacing: var(--tracking-title);
  margin: var(--space-1) 0 var(--space-2);
}
.quick-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}
.period-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-4);
  padding: var(--space-4) 0;
  border-top: 1px solid var(--color-border-subtle);
  border-bottom: 1px solid var(--color-border-subtle);
}
.period-title {
  font-size: var(--type-section);
  font-weight: var(--weight-strong);
}
.period-title::first-letter {
  text-transform: uppercase;
}
.month-controls {
  display: flex;
  align-items: flex-end;
  gap: var(--space-2);
  flex-wrap: wrap;
}
.month-input {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}
.month-navigation {
  display: flex;
  align-items: center;
  gap: var(--space-1);
}
.month-navigation input {
  width: 180px;
}
.month-navigation button {
  flex: none;
}
.monthly-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-4);
}
.pending-grid,
.due-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-4);
}
.indicator-label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
}
.indicator h3,
.pending h3 {
  font-size: var(--type-secondary);
  font-weight: var(--weight-heading);
}
.indicator-icon {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  border-radius: var(--radius-control);
  background: var(--color-brand-subtle-bg);
  color: var(--color-brand-subtle-fg);
  flex: none;
}
.indicator-icon.neutral {
  background: var(--color-surface-secondary);
  color: var(--color-text-secondary);
}
.indicator-value {
  font-size: var(--type-indicator);
  font-weight: var(--weight-strong);
  letter-spacing: var(--tracking-title);
  margin: var(--space-3) 0 var(--space-1);
  overflow-wrap: anywhere;
}
.result {
  background: var(--color-surface-secondary);
  border-color: var(--color-border-subtle);
  color: var(--color-text-primary);
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
.result .indicator-icon {
  background: var(--color-surface);
  color: inherit;
}
.outstanding-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin-bottom: var(--space-3);
}
.outstanding-heading h2 {
  font-size: var(--type-body);
}
.pending {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-3);
}
.pending > div {
  min-width: 0;
  flex: 1;
}
.indicator-link {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  font-size: var(--type-secondary);
  color: var(--color-link);
}
.updated-at {
  overflow-wrap: anywhere;
}
@media (max-width: 1000px) {
  .monthly-grid,
  .due-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
@media (max-width: 640px) {
  .pending-grid {
    grid-template-columns: minmax(0, 1fr);
  }
  .quick-actions {
    width: 100%;
  }
  .quick-actions > * {
    flex: 1;
  }
  .month-controls {
    width: 100%;
  }
  .period-bar > .field-error {
    flex-basis: 100%;
  }
}
</style>
