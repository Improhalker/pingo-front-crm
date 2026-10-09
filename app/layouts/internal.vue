<script setup lang="ts">
// Layout for internal project tools. It deliberately has no organization selector or client navigation.
const { user, logout } = useSession()
const leaving = ref(false)
const logoutError = ref('')

async function leave() {
  leaving.value = true
  logoutError.value = ''
  try {
    await logout('/plataforma/login')
  } catch {
    logoutError.value = 'Não foi possível encerrar a sessão. Tente novamente.'
  } finally {
    leaving.value = false
  }
}
</script>

<template>
  <div class="internal-shell">
    <a href="#main" class="button skip-link">Pular para o conteúdo</a>
    <header class="internal-header">
      <div class="internal-identity">
        <NuxtLink to="/plataforma" class="brand"
          ><span class="brand-mark" aria-hidden="true" />PingoFin</NuxtLink
        >
        <span class="internal-badge small">Ferramenta interna</span>
      </div>
      <div class="header-actions">
        <p class="small text-secondary internal-user">{{ user?.name }}</p>
        <ThemeSelect />
        <NuxtLink to="/plataforma" class="button secondary"
          >Voltar à plataforma</NuxtLink
        >
        <button class="button secondary" :disabled="leaving" @click="leave">
          {{ leaving ? 'Saindo…' : 'Sair' }}
        </button>
      </div>
    </header>
    <main id="main" class="internal-main" tabindex="-1">
      <p v-if="logoutError" class="notice error" role="alert">
        {{ logoutError }}
      </p>
      <slot />
    </main>
  </div>
</template>

<style scoped>
.internal-shell {
  min-height: 100dvh;
}
.internal-header {
  padding: var(--space-4) var(--space-8);
  border-bottom: 1px solid var(--color-border-subtle);
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--space-4);
}
.internal-identity {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-3);
}
.internal-badge {
  padding: var(--space-1) var(--space-3);
  border-radius: var(--radius-control);
  background: var(--color-accent-bg);
  color: var(--color-accent-fg);
  font-weight: var(--weight-heading);
}
.internal-user {
  align-self: center;
  overflow-wrap: anywhere;
}
.internal-main {
  padding: var(--space-8);
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}
@media (max-width: 640px) {
  .internal-header,
  .internal-main {
    padding: var(--space-4);
  }
  .header-actions {
    width: 100%;
  }
}
</style>
