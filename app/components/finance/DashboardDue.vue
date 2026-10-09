<script setup lang="ts">
import { ArrowUpRight, CalendarClock, CircleAlert } from '@lucide/vue'
import { Badge } from '~/components/ui/badge'
import type { DashboardDueList } from '~/types/dashboard'

defineProps<{
  list: DashboardDueList
  overdue?: boolean
  today: string
  until: string
}>()
const titleId = useId()
</script>

<template>
  <section class="card due-card" :aria-labelledby="titleId">
    <div class="due-heading">
      <h2 :id="titleId">
        <CircleAlert v-if="overdue" :size="19" /><CalendarClock
          v-else
          :size="19"
        />{{ overdue ? 'Em atraso' : 'Próximos vencimentos' }}
      </h2>
      <Badge :variant="overdue && list.total ? 'danger' : 'outline'">{{
        list.total
      }}</Badge>
    </div>
    <p class="small text-secondary">
      {{
        overdue
          ? 'Restantes vencidos antes de hoje.'
          : `Hoje até ${formatCivilDate(until)}.`
      }}
      Pendências independentes do mês selecionado.
    </p>
    <ul v-if="list.items.length">
      <li
        v-for="item in list.items"
        :key="`${item.kind}-${item.obligation_id}`"
      >
        <NuxtLink
          :to="`/${item.kind === 'RECEIVABLE' ? 'receitas' : 'despesas'}/${item.source_id}`"
          class="due-link"
        >
          <div class="due-content">
            <div class="due-kind small">
              {{ item.kind === 'RECEIVABLE' ? 'A receber' : 'A pagar' }} ·
              {{
                item.due_date === today
                  ? 'Vence hoje'
                  : formatCivilDate(item.due_date)
              }}
            </div>
            <p class="due-title">{{ item.description }}</p>
            <p class="small text-secondary">{{ item.counterpart }}</p>
          </div>
          <span class="due-money tabular"
            >{{ formatMoney(item.remaining_amount)
            }}<ArrowUpRight :size="16" aria-hidden="true"
          /></span>
        </NuxtLink>
      </li>
    </ul>
    <p v-else class="due-empty text-secondary">
      {{
        overdue
          ? 'Nenhuma pendência em atraso.'
          : 'Nenhuma pendência nesse intervalo.'
      }}
    </p>
    <p v-if="list.total > list.items.length" class="small text-secondary">
      Mostrando {{ list.items.length }} de {{ list.total }}. Consulte o restante
      em Receitas e Despesas.
    </p>
  </section>
</template>

<style scoped>
.due-card {
  min-width: 0;
}
.due-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  margin-bottom: var(--space-2);
}
.due-heading h2 {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}
.due-heading svg {
  color: var(--color-text-secondary);
  flex: none;
}
ul {
  list-style: none;
  padding: 0;
  margin: var(--space-4) 0 0;
}
li {
  border-top: 1px solid var(--color-border-subtle);
}
.due-link {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  justify-content: space-between;
  padding: var(--space-4) 0;
  text-decoration: none;
  color: var(--color-text-primary);
}
.due-link:hover .due-title {
  color: var(--color-brand-subtle-fg);
  text-decoration: underline;
}
.due-content {
  flex: 1;
  min-width: 0;
  overflow-wrap: anywhere;
}
.due-kind {
  color: var(--color-text-secondary);
}
.due-title {
  font-weight: var(--weight-heading);
  margin: var(--space-1) 0;
}
.due-money {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  font-weight: var(--weight-strong);
  overflow-wrap: anywhere;
}
.due-money svg {
  flex: none;
  color: var(--color-text-secondary);
}
.due-empty {
  padding: var(--space-6) 0;
}
@media (max-width: 640px) {
  .due-link {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
