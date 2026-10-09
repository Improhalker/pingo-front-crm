<script setup lang="ts">
definePageMeta({
  layout: false,
  middleware: async () => {
    const session = useSession()
    if (!(await session.ensureSession())) return navigateTo('/plataforma/login')
    if (session.user.value?.is_platform_administrator)
      return navigateTo('/plataforma')
  },
})
const { user, logout } = useSession()
const leaving = ref(false)
const error = ref('')
async function leave() {
  leaving.value = true
  error.value = ''
  try {
    await logout('/plataforma/login')
  } catch {
    error.value = 'Não foi possível encerrar a sessão. Tente novamente.'
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
      <section class="login-form">
        <div class="flex flex-col gap-3">
          <h1>Área restrita</h1>
          <p class="text-secondary">
            <template v-if="user">{{ user.email }} não</template
            ><template v-else>Esta conta não</template>
            tem acesso à administração do PingoFin. Esta área é exclusiva da
            equipe da plataforma.
          </p>
        </div>
        <p v-if="error" class="notice error" role="alert">{{ error }}</p>
        <NuxtLink v-if="user" to="/" class="button">
          Voltar ao meu espaço
        </NuxtLink>
        <button
          class="button secondary"
          type="button"
          :disabled="leaving"
          @click="leave"
        >
          {{ leaving ? 'Saindo…' : 'Entrar com outra conta' }}
        </button>
      </section>
      <p class="small text-secondary">
        Seu financeiro em dia, sem complicação.
      </p>
    </div>
  </main>
</template>
