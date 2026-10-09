<script setup lang="ts">
// Status is always written out; color and icon only reinforce it.
import { CircleCheck, CirclePause } from '@lucide/vue'
import { Badge } from '~/components/ui/badge'

defineProps<{ status: 'ACTIVE' | 'SUSPENDED' }>()
</script>
<template>
  <Badge :variant="status === 'SUSPENDED' ? 'warning' : 'success'">
    <CirclePause v-if="status === 'SUSPENDED'" />
    <CircleCheck v-else />
    {{ status === 'SUSPENDED' ? 'Suspensa' : 'Ativa' }}
  </Badge>
</template>
