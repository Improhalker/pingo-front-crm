<script setup lang="ts">
// Catalog record situation, written out (gendered to match "cliente" / "categoria").
import { Archive, CircleCheck } from '@lucide/vue'
import { Badge } from '~/components/ui/badge'

defineProps<{ archived: boolean; feminine?: boolean }>()
</script>

<template>
  <Badge v-if="archived" variant="outline">
    <Archive aria-hidden="true" />{{ feminine ? 'Arquivada' : 'Arquivado' }}
  </Badge>
  <Badge v-else variant="success">
    <CircleCheck aria-hidden="true" />{{ feminine ? 'Ativa' : 'Ativo' }}
  </Badge>
</template>
