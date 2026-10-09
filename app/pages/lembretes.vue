<script setup lang="ts">
// Internal reminders (card 10, ADR-032): open instalments whose reminder date arrived in the company's
// calendar, and the next ones. Settling is never automatic: "Registrar" opens the entry on that instalment
// for review and the explicit, authorized receipt/payment.
import { BellRing, HandCoins, RotateCcw } from '@lucide/vue'
import { Alert, AlertDescription } from '~/components/ui/alert'
import { Button } from '~/components/ui/button'
import { Skeleton } from '~/components/ui/skeleton'
import { methodLabel, type ReminderItem, type Reminders } from '~/types/finance'

definePageMeta({ middleware: 'auth' })
const { organization, run } = useFinance()
usePageHeading(() => ({
  title: 'Lembretes',
  crumbs: organization.value ? [{ label: organization.value.name }] : [],
}))
const lane = createLatestRequest()
const data = ref<Reminders | null>(null)
const loading = ref(false)
const error = ref('')

async function load() {
  if (!organization.value) return
  loading.value = true
  error.value = ''
  try {
    const result = await run(
      (api, signal) => api.reminders(signal),
      lane.begin(),
    )
    if (!result.ok) return
    data.value = result.value.data
    loading.value = false
  } catch (cause) {
    error.value = financeErrorMessage(
      cause,
      'Não foi possível carregar os lembretes. Tente novamente.',
    )
    loading.value = false
  }
}
function link(item: ReminderItem) {
  const base = item.kind === 'RECEIVABLE' ? '/receitas' : '/despesas'
  return `${base}/${item.entry_id}?parcela=${item.installment_id}`
}
function lineLabel(item: ReminderItem) {
  if (item.is_down_payment) return 'Entrada'
  return item.instalments_total > 1
    ? `Parcela ${item.number} de ${item.instalments_total}`
    : 'Parcela única'
}
const sections = computed(() =>
  data.value
    ? [
        {
          id: 'due',
          title: 'Para hoje ou já passados',
          empty:
            'Nenhum lembrete chegou. Quando a data de um lembrete chegar, ele aparece aqui.',
          block: data.value.due,
        },
        {
          id: 'upcoming',
          title: `Próximos dias (até ${formatCivilDate(data.value.upcoming_until)})`,
          empty: 'Nenhum lembrete nos próximos 7 dias.',
          block: data.value.upcoming,
        },
      ]
    : [],
)

watch(
  () => organization.value?.id,
  (id) => {
    lane.cancel()
    data.value = null
    error.value = ''
    if (id) load()
  },
  { immediate: true },
)
onBeforeUnmount(() => lane.cancel())
</script>

<template>
  <FinanceContextGate>
    <div class="reminders">
      <p class="intro text-secondary">
        Lembretes de recebimentos e pagamentos em aberto. Eles não registram
        nada sozinhos: confira o lançamento e registre a baixa quando o dinheiro
        realmente entrar ou sair. Parcelas quitadas não aparecem, e as parciais
        mostram só o que falta.
      </p>

      <Alert v-if="error" variant="destructive" role="alert">
        <AlertDescription class="error-line">
          {{ error }}
          <Button variant="outline" size="sm" @click="load">
            <RotateCcw />Tentar novamente
          </Button>
        </AlertDescription>
      </Alert>

      <div v-if="loading && !data" class="card loading" role="status">
        <span class="sr-only">Carregando lembretes…</span>
        <Skeleton class="h-6 w-56 max-w-full" />
        <Skeleton class="h-16 w-full" />
      </div>

      <section
        v-for="section in sections"
        :key="section.id"
        class="card section"
        :aria-labelledby="`${section.id}-title`"
      >
        <h2 :id="`${section.id}-title`">
          {{ section.title }}
          <span class="count">({{ section.block.total }})</span>
        </h2>
        <p v-if="!section.block.items.length" class="text-secondary">
          {{ section.empty }}
        </p>
        <ul v-else class="items">
          <li v-for="item in section.block.items" :key="item.installment_id">
            <span class="icon" aria-hidden="true"><BellRing :size="18" /></span>
            <div class="text">
              <p class="title">
                {{ item.kind === 'RECEIVABLE' ? 'Receber' : 'Pagar' }}
                <strong class="tabular">{{
                  formatMoney(item.remaining_amount)
                }}</strong>
                <template v-if="item.remaining_amount !== item.amount">
                  de {{ formatMoney(item.amount) }}</template
                >
                · {{ item.description }}
              </p>
              <p class="small text-secondary">
                {{ item.counterpart }} · {{ lineLabel(item) }} · vence em
                {{ formatCivilDate(item.due_date) }} ·
                {{ methodLabel(item.expected_method) }} · lembrete de
                {{ formatCivilDate(item.reminder_date) }}
              </p>
            </div>
            <FinanceStatusBadge :status="item.status" />
            <Button as-child variant="outline" size="sm">
              <NuxtLink :to="link(item)"
                ><HandCoins aria-hidden="true" />Revisar e registrar
                <span class="sr-only"
                  >{{
                    item.kind === 'RECEIVABLE' ? 'recebimento' : 'pagamento'
                  }}
                  de {{ item.description }}</span
                ></NuxtLink
              >
            </Button>
          </li>
        </ul>
        <p
          v-if="section.block.total > section.block.items.length"
          class="small text-secondary"
        >
          Mostrando {{ section.block.items.length }} de
          {{ section.block.total }}.
        </p>
      </section>
    </div>
  </FinanceContextGate>
</template>

<style scoped>
.reminders {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
  max-width: 960px;
}
.intro {
  max-width: 72ch;
}
.loading,
.section {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}
.count {
  font-weight: var(--weight-normal);
  color: var(--color-text-secondary);
}
.items {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
}
.items li {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-3);
  padding: var(--space-3) 0;
  border-top: 1px solid var(--color-border-subtle);
}
.items li:first-child {
  border-top: 0;
}
.icon {
  display: inline-grid;
  place-items: center;
  width: 36px;
  height: 36px;
  flex: none;
  border-radius: var(--radius-control);
  background: var(--color-brand-subtle-bg);
  color: var(--color-brand-subtle-fg);
}
.text {
  flex: 1 1 280px;
  min-width: 0;
}
.title {
  overflow-wrap: anywhere;
}
.error-line {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--space-3);
}
</style>
