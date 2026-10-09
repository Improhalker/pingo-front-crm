<script setup lang="ts">
import { ChevronLeft, ChevronRight } from '@lucide/vue'
import { Button } from '~/components/ui/button'
import type { PageMeta } from '~/types/api'

defineProps<{
  meta: PageMeta
  loading: boolean
  label: string
  noun: [singular: string, plural: string]
}>()
defineEmits<{ go: [page: number] }>()
</script>

<template>
  <nav class="finance-pager" :aria-label="label">
    <p aria-live="polite">
      {{ meta.total }} {{ meta.total === 1 ? noun[0] : noun[1] }} · página
      {{ meta.current_page }} de {{ meta.last_page }}
      <span v-if="loading"> · atualizando…</span>
    </p>
    <div v-if="meta.last_page > 1" class="pager-buttons">
      <Button
        variant="outline"
        size="sm"
        :disabled="loading || meta.current_page <= 1"
        @click="$emit('go', meta.current_page - 1)"
      >
        <ChevronLeft />Anterior
      </Button>
      <Button
        variant="outline"
        size="sm"
        :disabled="loading || meta.current_page >= meta.last_page"
        @click="$emit('go', meta.current_page + 1)"
      >
        Próxima<ChevronRight />
      </Button>
    </div>
  </nav>
</template>

<style scoped>
.finance-pager {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4) var(--space-3) var(--space-6);
  border-top: 1px solid var(--color-border-subtle);
  font-size: var(--type-secondary);
  color: var(--color-text-secondary);
}
.pager-buttons {
  display: flex;
  gap: var(--space-2);
}
@media (max-width: 640px) {
  .finance-pager {
    padding: var(--space-3) var(--space-4);
  }
}
</style>
