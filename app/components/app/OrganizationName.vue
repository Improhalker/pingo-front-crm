<script setup lang="ts">
// The account's single company, shown as information only (ADR-028): there is no selector.
import { Building2 } from '@lucide/vue'

const { organization, loading } = useSession()
</script>

<template>
  <div class="org-name" :aria-busy="loading">
    <Building2 :size="18" aria-hidden="true" class="org-icon" />
    <span class="org-text">
      <span class="org-label">Empresa</span>
      <span class="org-value">
        <template v-if="organization">{{ organization.name }}</template>
        <template v-else-if="loading">Abrindo…</template>
        <template v-else>—</template>
      </span>
    </span>
  </div>
</template>

<style scoped>
.org-name {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-height: 44px;
  min-width: 0;
  max-width: 320px;
}
.org-icon {
  flex: none;
  color: var(--color-text-secondary);
}
.org-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
  line-height: 1.25;
}
.org-label {
  font-size: var(--type-secondary);
  color: var(--color-text-secondary);
}
.org-value {
  font-size: var(--type-secondary);
  font-weight: var(--weight-strong);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
@media (max-width: 640px) {
  .org-name {
    flex: 1;
    max-width: none;
  }
}
</style>
