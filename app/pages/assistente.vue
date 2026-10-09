<script setup lang="ts">
import { Skeleton } from '~/components/ui/skeleton'

definePageMeta({ middleware: 'auth' })
const { organization, loading } = useSession()
usePageHeading(() => ({
  title: 'Pingo',
  crumbs: organization.value ? [{ label: organization.value.name }] : [],
}))
</script>

<template>
  <div>
    <div v-if="loading" class="card loading" role="status">
      <span class="sr-only">Abrindo sua organização…</span>
      <Skeleton class="h-6 w-56 max-w-full" />
      <Skeleton class="h-40 w-full" />
    </div>
    <PingoChatBox v-else-if="organization" area="company" />
    <FinanceContextGate v-else />
  </div>
</template>

<style scoped>
.loading {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}
</style>
