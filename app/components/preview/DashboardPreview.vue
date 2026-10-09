<script setup lang="ts">
// Development-only composition study of the future company dashboard (DESIGN_SYSTEM.md §10).
// Every value is an illustrative string: nothing is calculated, read from an organization or
// sent to the API. Rendered only by the /dev/referencias gallery.
import { CalendarClock, CircleAlert, CircleCheck } from '@lucide/vue'
import { Badge } from '~/components/ui/badge'
import { chartReferenceSrc } from '~/config/visual-references'

const { resolved } = useTheme()
const indicators = [
  {
    label: 'Entradas',
    value: 'R$ 12.380,00',
    base: 'Recebido em outubro, até 05/10',
  },
  { label: 'Saídas', value: 'R$ 7.915,40', base: 'Pago em outubro, até 05/10' },
  {
    label: 'Resultado',
    value: '+R$ 4.464,60',
    base: 'Entradas menos saídas no período',
  },
  { label: 'A receber', value: 'R$ 2.400,00', base: 'Próximos 30 dias' },
  { label: 'A pagar', value: 'R$ 3.150,00', base: 'Próximos 30 dias' },
]
const dueItems = [
  {
    title: 'Aluguel da sala',
    date: 'Hoje',
    value: 'R$ 1.800,00',
    status: 'today',
  },
  {
    title: 'Combustível da frota',
    date: 'Atrasado desde 03/10',
    value: 'R$ 640,00',
    status: 'late',
  },
  {
    title: 'Mensalidade · turma B',
    date: 'Recebido em 04/10',
    value: 'R$ 950,00',
    status: 'paid',
  },
] as const
</script>

<template>
  <div class="dashboard-preview">
    <p class="preview-flag">
      <Badge variant="highlight">Dados ilustrativos</Badge>
      Composição de estudo. Não são valores de uma organização.
    </p>
    <div class="top-row">
      <section class="balance card" aria-labelledby="preview-balance">
        <p id="preview-balance" class="label">Saldo atual</p>
        <p class="balance-value tabular">R$ 18.420,30</p>
        <p class="base">Contas cadastradas, em 05/10/2026 às 10:00</p>
      </section>
      <section class="indicators" aria-label="Indicadores do período">
        <div
          v-for="item in indicators"
          :key="item.label"
          class="indicator card"
        >
          <p class="label">{{ item.label }}</p>
          <p class="indicator-value tabular">{{ item.value }}</p>
          <p class="base">{{ item.base }}</p>
        </div>
      </section>
    </div>
    <div class="bottom-row">
      <section class="card due" aria-labelledby="preview-due">
        <h3 id="preview-due">Vencimentos e atrasos</h3>
        <ul>
          <li v-for="item in dueItems" :key="item.title">
            <span class="due-text">
              <span class="due-title">{{ item.title }}</span>
              <span class="base">{{ item.date }}</span>
            </span>
            <span class="due-value tabular">{{ item.value }}</span>
            <Badge
              :variant="
                item.status === 'late'
                  ? 'danger'
                  : item.status === 'today'
                    ? 'warning'
                    : 'success'
              "
            >
              <CircleAlert v-if="item.status === 'late'" />
              <CalendarClock v-else-if="item.status === 'today'" />
              <CircleCheck v-else />
              {{
                item.status === 'late'
                  ? 'Atrasado'
                  : item.status === 'today'
                    ? 'Vence hoje'
                    : 'Recebido'
              }}
            </Badge>
          </li>
        </ul>
      </section>
      <figure class="chart">
        <img
          :src="chartReferenceSrc('fluxo-caixa', resolved)"
          alt="Entradas e saídas por mês, valores ilustrativos"
          width="720"
          height="420"
        />
        <figcaption class="base">
          Como variam entradas e saídas? Série ilustrativa de 6 meses.
        </figcaption>
      </figure>
    </div>
  </div>
</template>

<style scoped>
.dashboard-preview {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}
.preview-flag {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-2);
  font-size: var(--type-secondary);
  color: var(--color-text-secondary);
}
.top-row {
  display: grid;
  grid-template-columns: minmax(260px, 1fr) minmax(0, 2.4fr);
  gap: var(--space-4);
}
.label {
  font-size: var(--type-secondary);
  font-weight: var(--weight-heading);
  color: var(--color-text-secondary);
}
.base {
  font-size: var(--type-secondary);
  color: var(--color-text-secondary);
}
.balance {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  background: var(--sidebar-bg);
  border-color: transparent;
  color: var(--sidebar-fg);
}
.balance .label,
.balance .base {
  color: var(--sidebar-fg-secondary);
}
.balance-value {
  font-size: var(--type-balance);
  font-weight: var(--weight-brand);
  letter-spacing: var(--tracking-title);
  line-height: 1.15;
}
.indicators {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-4);
}
.indicator {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  padding: var(--space-4);
}
.indicator-value {
  font-size: 22px;
  font-weight: var(--weight-strong);
}
.bottom-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.3fr);
  gap: var(--space-4);
}
.due ul {
  margin: var(--space-4) 0 0;
  padding: 0;
  list-style: none;
}
.due li {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) 0;
  border-top: 1px solid var(--color-border-subtle);
}
.due-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.due-title {
  font-weight: var(--weight-heading);
}
.due-value {
  font-weight: var(--weight-strong);
  text-align: right;
}
.chart {
  margin: 0;
}
.chart img {
  display: block;
  width: 100%;
  height: auto;
}
.chart figcaption {
  margin-top: var(--space-2);
}
@media (max-width: 1000px) {
  .top-row,
  .bottom-row {
    grid-template-columns: minmax(0, 1fr);
  }
}
@media (max-width: 640px) {
  .indicators {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 400px) {
  .indicators {
    grid-template-columns: minmax(0, 1fr);
  }
}
@media (max-width: 480px) {
  .due li {
    grid-template-columns: minmax(0, 1fr) auto;
  }
  .due li :deep([data-slot='badge']),
  .due li > :last-child {
    grid-column: 1 / -1;
    justify-self: start;
  }
}
</style>
