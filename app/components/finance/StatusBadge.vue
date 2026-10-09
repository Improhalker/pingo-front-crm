<script setup lang="ts">
// Receivable status is always written out; icon and color only reinforce it.
import { CircleAlert, CircleCheck, Clock } from '@lucide/vue'
import { Badge } from '~/components/ui/badge'
import type { ReceivableStatus, PayableStatus } from '~/types/finance'

const props = defineProps<{ status: ReceivableStatus | PayableStatus }>()
const views = {
  PENDING: { label: 'Pendente', variant: 'info', icon: Clock },
  OVERDUE: { label: 'Atrasado', variant: 'danger', icon: CircleAlert },
  RECEIVED: { label: 'Recebido', variant: 'success', icon: CircleCheck },
  PAID: { label: 'Quitado', variant: 'success', icon: CircleCheck },
} as const
const view = computed(() => views[props.status])
</script>

<template>
  <Badge :variant="view.variant">
    <component :is="view.icon" aria-hidden="true" />{{ view.label }}
  </Badge>
</template>
