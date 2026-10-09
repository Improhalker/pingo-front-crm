<script setup lang="ts">
import { CirclePlus, RotateCcw, X } from '@lucide/vue'
import { Alert, AlertDescription } from '~/components/ui/alert'
import { Button } from '~/components/ui/button'
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
import type { PageMeta } from '~/types/api'
import type { Revenue } from '~/types/finance'

definePageMeta({ middleware: 'auth' })
const { organization, timezone, run, takeNotice } = useFinance()
usePageHeading(() => ({
  title: 'Receitas',
  crumbs: organization.value ? [{ label: organization.value.name }] : [],
}))

type StatusFilter = '' | 'pending' | 'overdue' | 'received'
const lane = createLatestRequest()
const items = ref<Revenue[]>([])
const meta = ref<PageMeta | null>(null)
const loading = ref(false)
const error = ref('')
const notice = ref('')
const search = ref('')
const status = ref<string>('')
const applied = ref<{ search: string; status: StatusFilter }>({
  search: '',
  status: '',
})
const statusOptions = [
  { value: '', label: 'Todas' },
  { value: 'pending', label: 'Pendentes' },
  { value: 'overdue', label: 'Atrasadas' },
  { value: 'received', label: 'Recebidas' },
]
const filtered = computed(
  () => !!(applied.value.search || applied.value.status),
)
const today = computed(() => todayIn(timezone.value))

function afterDelete() {
  notice.value = takeNotice()
  void load(
    items.value.length === 1
      ? Math.max(1, (meta.value?.current_page ?? 1) - 1)
      : (meta.value?.current_page ?? 1),
  )
}
function afterSave() {
  notice.value = 'Alterações salvas.'
  void load(meta.value?.current_page ?? 1)
}
async function load(page = 1) {
  if (!organization.value) return
  loading.value = true
  error.value = ''
  try {
    const result = await run(
      (api, signal) =>
        api.revenues(
          {
            page,
            search: applied.value.search,
            status: applied.value.status || undefined,
          },
          signal,
        ),
      lane.begin(),
    )
    if (!result.ok) return
    items.value = result.value.data
    meta.value = result.value.meta
    loading.value = false
  } catch (cause) {
    error.value = financeErrorMessage(
      cause,
      'Não foi possível carregar as receitas. Tente novamente.',
    )
    loading.value = false
  }
}
function applyFilters() {
  applied.value = {
    search: search.value.trim(),
    status: status.value as StatusFilter,
  }
  return load(1)
}
function clearFilters() {
  search.value = ''
  status.value = ''
  return applyFilters()
}

// Organization change or end of session: drop everything of the previous context and start over.
watch(
  () => organization.value?.id,
  (id) => {
    lane.cancel()
    items.value = []
    meta.value = null
    loading.value = false
    error.value = ''
    notice.value = takeNotice()
    search.value = ''
    status.value = ''
    applied.value = { search: '', status: '' }
    if (id) load()
  },
  { immediate: true },
)
onBeforeUnmount(() => lane.cancel())
</script>

<template>
  <FinanceContextGate>
    <div class="revenues">
      <section class="list" aria-labelledby="list-title" :aria-busy="loading">
        <Alert v-if="notice" variant="success" role="status"
          ><AlertDescription>{{ notice }}</AlertDescription></Alert
        >
        <div class="toolbar">
          <div class="toolbar-title">
            <h2 id="list-title">Vendas e recebimentos</h2>
            <p class="small text-secondary">
              Cada venda tem um vencimento. Ela só conta como recebida depois
              que você registra a baixa.
            </p>
          </div>
          <Button as-child>
            <NuxtLink to="/receitas/nova"><CirclePlus />Nova receita</NuxtLink>
          </Button>
        </div>

        <form
          class="filters"
          role="search"
          aria-label="Filtrar receitas"
          @submit.prevent="applyFilters"
        >
          <div class="field">
            <span id="revenue-status-label" class="field-label">Situação</span>
            <AppSegmented
              v-model="status"
              aria-labelledby="revenue-status-label"
              :options="statusOptions"
              :disabled="loading"
              @update:model-value="applyFilters"
            />
          </div>
          <FinanceSearchField
            v-model="search"
            label="Buscar por descrição ou cliente"
            :disabled="loading"
          />
          <Button
            v-if="filtered"
            type="button"
            variant="ghost"
            :disabled="loading"
            @click="clearFilters"
          >
            <X />Limpar filtros
          </Button>
        </form>

        <Alert v-if="error" variant="destructive" role="alert">
          <AlertDescription class="error-line">
            {{ error }}
            <Button
              variant="outline"
              size="sm"
              @click="load(meta?.current_page ?? 1)"
            >
              <RotateCcw />Tentar novamente
            </Button>
          </AlertDescription>
        </Alert>

        <FinanceListCard>
          <div
            v-if="loading && !items.length"
            class="list-skeleton"
            role="status"
          >
            <span class="sr-only">Carregando receitas…</span>
            <div v-for="row in 4" :key="row" class="list-skeleton-row">
              <Skeleton class="h-4 w-56 max-w-full" />
              <Skeleton class="h-3 w-36 max-w-full" />
            </div>
          </div>

          <div v-else-if="!items.length && !error" class="list-empty">
            <template v-if="filtered">
              <p class="list-empty-title">Nenhuma receita encontrada.</p>
              <p class="text-secondary">
                Nenhuma receita corresponde a esses filtros.
              </p>
              <Button variant="outline" @click="clearFilters">
                Limpar filtros
              </Button>
            </template>
            <template v-else>
              <p class="list-empty-title">Nenhuma receita registrada ainda.</p>
              <p class="text-secondary">
                Registre a primeira venda para acompanhar o que já foi recebido
                e o que falta receber.
              </p>
              <Button as-child variant="outline">
                <NuxtLink to="/receitas/nova">Registrar receita</NuxtLink>
              </Button>
            </template>
          </div>

          <Table v-else-if="items.length">
            <TableCaption class="sr-only">
              Receitas da mais recente para a mais antiga, por data da venda.
              Valores em reais.
            </TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>Venda</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead class="numeric">Vendido</TableHead>
                <TableHead class="numeric">Recebido</TableHead>
                <TableHead class="numeric">Restante</TableHead>
                <TableHead>Situação</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-for="item in items" :key="item.id">
                <TableHead scope="row" class="row-head">
                  <span class="row-title">
                    <NuxtLink :to="`/receitas/${item.id}`" class="row-name">{{
                      item.description
                    }}</NuxtLink>
                    <span class="row-meta"
                      >{{ item.customer.name }} · vendida em
                      {{ formatCivilDate(item.sale_date) }}</span
                    >
                  </span>
                </TableHead>
                <TableCell data-label="Vencimento" class="tabular">
                  <span class="due">
                    {{ formatCivilDate(item.receivable.due_date) }}
                    <span
                      v-if="
                        item.status === 'PENDING' &&
                        item.receivable.due_date === today
                      "
                      class="due-today"
                      >vence hoje</span
                    >
                  </span>
                </TableCell>
                <TableCell data-label="Vendido" class="numeric tabular">
                  {{ formatMoney(item.total_amount) }}
                </TableCell>
                <TableCell data-label="Recebido" class="numeric tabular">
                  {{ formatMoney(item.received_amount) }}
                </TableCell>
                <TableCell
                  data-label="Restante"
                  class="numeric tabular remaining"
                >
                  {{ formatMoney(item.remaining_amount) }}
                </TableCell>
                <TableCell data-label="Situação">
                  <FinanceStatusBadge :status="item.status" />
                </TableCell>
                <TableCell class="row-actions-cell"
                  ><FinanceEntryActions
                    :entry="item"
                    kind="revenue"
                    :disabled="loading"
                    @saved="afterSave"
                    @deleted="afterDelete"
                /></TableCell>
              </TableRow>
            </TableBody>
          </Table>

          <FinancePager
            v-if="meta && items.length"
            :meta="meta"
            :loading="loading"
            label="Paginação das receitas"
            :noun="['receita', 'receitas']"
            @go="load"
          />
        </FinanceListCard>
      </section>
    </div>
  </FinanceContextGate>
</template>

<style scoped>
.revenues,
.list {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}
.revenues {
  gap: var(--space-6);
}
.toolbar {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--space-4) var(--space-6);
}
.toolbar-title {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  max-width: 62ch;
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
.remaining {
  font-weight: var(--weight-strong);
}
.due-today {
  display: block;
  color: var(--color-text-secondary);
  font-size: var(--type-secondary);
}
@media (min-width: 641px) {
  .list :deep(.row-head) {
    min-width: 180px;
  }
}
@media (max-width: 640px) {
  .toolbar > a,
  .filters,
  .filters .field {
    width: 100%;
  }
  .filters :deep(.segmented) {
    width: 100%;
  }
  .filters :deep(.segment) {
    padding: 0 var(--space-2);
  }
}
@media (max-width: 360px) {
  .filters :deep(.segmented) {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    height: auto;
    gap: var(--space-1);
  }
  .filters :deep(.segment) {
    min-width: 0;
    min-height: var(--control-height);
  }
}
</style>
