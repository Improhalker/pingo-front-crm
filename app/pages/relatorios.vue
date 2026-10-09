<script setup lang="ts">
// Reports (card 11, ADR-033): monthly result, cash statement (realizado) and open instalments (previsto).
// Each view is a link (?visao=) so it can be shared and keeps the browser history.
import { CalendarClock, ChartColumn, ReceiptText } from '@lucide/vue'
import type { Category } from '~/types/finance'

definePageMeta({ middleware: 'auth' })
const { organization, run } = useFinance()
usePageHeading(() => ({
  title: 'Relatórios',
  crumbs: organization.value ? [{ label: organization.value.name }] : [],
}))

const views = [
  { id: 'mensal', label: 'Resultado mensal', icon: ChartColumn },
  { id: 'extrato', label: 'Extrato do realizado', icon: ReceiptText },
  { id: 'previsto', label: 'A receber e a pagar', icon: CalendarClock },
] as const
type View = (typeof views)[number]['id']
const route = useRoute()
const view = computed<View>(() => {
  const requested = route.query.visao
  return views.some((item) => item.id === requested)
    ? (requested as View)
    : 'mensal'
})

// Categories for the filters, archived included (old movements keep their category).
const lane = createLatestRequest()
const categories = ref<Category[]>([])
async function loadCategories() {
  try {
    const result = await run(
      (api, signal) => api.categories({ status: 'all', per_page: 100 }, signal),
      lane.begin(),
    )
    if (result.ok) categories.value = result.value.data
  } catch {
    // Filters still work without the category list; the reports themselves report their own errors.
    categories.value = []
  }
}
watch(
  () => organization.value?.id,
  (id) => {
    lane.cancel()
    categories.value = []
    if (id) loadCategories()
  },
  { immediate: true },
)
onBeforeUnmount(() => lane.cancel())
</script>

<template>
  <FinanceContextGate>
    <div class="reports">
      <nav class="views" aria-label="Relatórios disponíveis">
        <NuxtLink
          v-for="item in views"
          :key="item.id"
          :to="{ query: { visao: item.id } }"
          class="view-link"
          :aria-current="view === item.id ? 'page' : undefined"
          ><component :is="item.icon" aria-hidden="true" />{{
            item.label
          }}</NuxtLink
        >
      </nav>

      <FinanceReportMonthly v-if="view === 'mensal'" />
      <FinanceReportStatement
        v-else-if="view === 'extrato'"
        :categories="categories"
      />
      <FinanceReportForecast v-else :categories="categories" />
    </div>
  </FinanceContextGate>
</template>

<style scoped>
.reports {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}
.views {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  padding: var(--space-1);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-control);
  background: var(--color-surface-secondary);
  width: fit-content;
  max-width: 100%;
}
.view-link {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  min-height: var(--control-height);
  padding: 0 var(--space-4);
  border-radius: var(--radius-inner);
  color: var(--color-text-secondary);
  font-size: var(--type-secondary);
  font-weight: var(--weight-heading);
  text-decoration: none;
}
.view-link svg {
  width: 18px;
  height: 18px;
  flex: none;
}
.view-link:hover {
  color: var(--color-text-primary);
}
.view-link[aria-current='page'] {
  background: var(--color-surface);
  color: var(--color-text-primary);
  box-shadow: var(--elevation-1);
}
.view-link:focus-visible {
  outline: 2px solid var(--color-focus);
  outline-offset: 2px;
}
@media (max-width: 640px) {
  .views {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    width: 100%;
  }
}
</style>
