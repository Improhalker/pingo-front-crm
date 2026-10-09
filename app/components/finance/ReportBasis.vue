<script setup lang="ts">
// What a report covers (card 11): period, timezone, base and reading instant, always written out.
defineProps<{
  period: string
  basis: string
  timezone: string
  asOf: string
}>()
</script>

<template>
  <dl class="report-basis small">
    <div>
      <dt>Período</dt>
      <dd>{{ period }}</dd>
    </div>
    <div>
      <dt>Base</dt>
      <dd>{{ basis }}</dd>
    </div>
    <div>
      <dt>Fuso horário</dt>
      <dd>{{ timezone }}</dd>
    </div>
    <div>
      <dt>Consultado em</dt>
      <dd>{{ formatInstant(asOf, timezone) }}</dd>
    </div>
  </dl>
</template>

<style scoped>
.report-basis {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2) var(--space-6);
  padding: var(--space-3) var(--space-4);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-control);
  background: var(--color-surface-secondary);
}
.report-basis div {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.report-basis dt {
  color: var(--color-text-secondary);
}
.report-basis dd {
  color: var(--color-text-primary);
  font-weight: var(--weight-heading);
  overflow-wrap: anywhere;
}
</style>
