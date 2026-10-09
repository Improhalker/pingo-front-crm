<script setup lang="ts">
import { readHealth } from '~/services/health'
definePageMeta({ middleware: 'session' })
if (!import.meta.dev) throw createError({ statusCode: 404 })
const { $api } = useNuxtApp()
const { data, error, pending, refresh } = await useAsyncData('dev.health', () =>
  readHealth($api),
)
</script>
<template>
  <section class="card welcome">
    <h2>Diagnóstico de desenvolvimento</h2>
    <p class="text-secondary">
      Chamada do navegador à API local. Esta área só existe no servidor de
      desenvolvimento.
    </p>
    <p v-if="pending" role="status">Verificando dependências…</p>
    <p v-else-if="error" class="notice error" role="alert">
      A API não confirmou prontidão. Verifique o health check e os logs locais.
    </p>
    <pre v-else class="small tabular">{{ data?.data }}</pre>
    <button class="button" :disabled="pending" @click="refresh()">
      Verificar novamente
    </button>
  </section>
</template>
