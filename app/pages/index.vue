<script setup lang="ts">
definePageMeta({ middleware: 'auth' })
const { user, organization } = useSession()
usePageHeading(() => ({
  title: 'Visão geral',
  crumbs: organization.value ? [{ label: organization.value.name }] : [],
}))
const firstName = computed(() => user.value?.name.split(/\s+/)[0] ?? '')
</script>

<template>
  <div class="home">
    <!-- The account's single company opens automatically (ADR-028); no selection step. -->
    <FinanceContextGate>
      <FinanceDashboardOverview :first-name="firstName" />
    </FinanceContextGate>
  </div>
</template>

<style scoped>
.home {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}
</style>
