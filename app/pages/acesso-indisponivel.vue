<script setup lang="ts">
// Shown when a signed-in company account cannot open its company (ADR-028). It never redirects back to a
// company route unless the server reports the company open again, so there is no redirect loop.
definePageMeta({
  layout: false,
  middleware: async () => {
    const state = await useSession().ensureContext()
    if (state === 'signed-out') return navigateTo('/login')
    if (state === 'platform') return navigateTo('/plataforma')
    if (state === 'ready') return navigateTo('/')
  },
})
const { user, accessIssue, error, ensureContext, logout } = useSession()
const leaving = ref(false)
const retrying = ref(false)
const leaveError = ref('')
const title = computed(() =>
  accessIssue.value?.code === 'ORGANIZATION_SUSPENDED'
    ? 'Empresa suspensa'
    : 'Não foi possível abrir sua empresa',
)
async function retry() {
  if (retrying.value) return
  retrying.value = true
  try {
    const state = await ensureContext()
    if (state === 'ready') await navigateTo('/')
    else if (state === 'signed-out') await navigateTo('/login')
  } finally {
    retrying.value = false
  }
}
async function leave() {
  if (leaving.value) return
  leaving.value = true
  leaveError.value = ''
  try {
    await logout('/login')
  } catch {
    leaveError.value = 'Não foi possível encerrar a sessão. Tente novamente.'
  } finally {
    leaving.value = false
  }
}
</script>
<template>
  <main class="login-page">
    <div class="login-main">
      <header class="login-toolbar">
        <span class="brand"
          ><span class="brand-mark" aria-hidden="true" />PingoFin</span
        ><ThemeSelect />
      </header>
      <section class="login-form" aria-labelledby="unavailable-title">
        <div class="flex flex-col gap-3">
          <h1 id="unavailable-title">{{ title }}</h1>
          <p v-if="user" class="small text-secondary">
            Conta: {{ user.email }}
          </p>
        </div>
        <p class="notice error" role="alert">
          {{
            accessIssue?.message ||
            error ||
            'Sua conta não conseguiu abrir a empresa vinculada.'
          }}
        </p>
        <p v-if="leaveError" class="notice error" role="alert">
          {{ leaveError }}
        </p>
        <button
          class="button"
          type="button"
          :disabled="retrying"
          :aria-busy="retrying"
          @click="retry"
        >
          {{ retrying ? 'Verificando…' : 'Tentar novamente' }}
        </button>
        <button
          class="button secondary"
          type="button"
          :disabled="leaving"
          @click="leave"
        >
          {{ leaving ? 'Saindo…' : 'Sair' }}
        </button>
      </section>
      <p class="small text-secondary">
        Seu financeiro em dia, sem complicação.
      </p>
    </div>
  </main>
</template>
