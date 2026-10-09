<script setup lang="ts">
// Company screens need the account's company open. It opens automatically (ADR-028); this gate only
// covers the loading moment and a failure to reach the API, with a retry. Access denials go to
// /acesso-indisponivel through ensureContext.
import { RotateCw } from '@lucide/vue'
import { Button } from '~/components/ui/button'
import { Skeleton } from '~/components/ui/skeleton'

const { organization, loading, error, ensureContext } = useSession()
const retrying = ref(false)
async function retry() {
  if (retrying.value) return
  retrying.value = true
  try {
    const state = await ensureContext()
    if (state === 'blocked') await navigateTo('/acesso-indisponivel')
    else if (state === 'signed-out') await navigateTo('/login')
  } finally {
    retrying.value = false
  }
}
</script>

<template>
  <slot v-if="organization" />
  <div v-else-if="loading || retrying" class="card gate" role="status">
    <span class="sr-only">Abrindo sua empresa…</span>
    <Skeleton class="h-6 w-56 max-w-full" />
    <Skeleton class="h-4 w-80 max-w-full" />
  </div>
  <section v-else class="card gate" aria-labelledby="gate-title">
    <h2 id="gate-title">Não conseguimos abrir sua empresa</h2>
    <p class="text-secondary">
      {{ error || 'Verifique sua conexão e tente novamente.' }}
    </p>
    <div>
      <Button variant="outline" @click="retry">
        <RotateCw aria-hidden="true" />
        Tentar novamente
      </Button>
    </div>
  </section>
</template>

<style scoped>
.gate {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  max-width: 720px;
}
</style>
