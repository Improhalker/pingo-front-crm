<script setup lang="ts">
import { platformNavigation } from '~/config/navigation'
import { Alert, AlertDescription } from '~/components/ui/alert'

const { user, logout } = useSession()
const leaving = ref(false)
const logoutError = ref('')
async function leave() {
  if (leaving.value) return
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
  <AppShell
    :sections="user?.is_platform_administrator ? platformNavigation : []"
    area-label="Administração da plataforma"
    home-to="/plataforma"
  >
    <template #note>
      A administração cadastra empresas e acessos. Os dados de cada empresa
      ficam no espaço dela.
    </template>
    <template #actions>
      <AppAccountMenu
        v-if="user"
        :name="user.name"
        :email="user.email"
        role="Conta master"
        :leaving="leaving"
        @logout="leave"
      />
    </template>
    <Alert v-if="logoutError" variant="destructive" role="alert">
      <AlertDescription>{{ logoutError }}</AlertDescription>
    </Alert>
    <slot />
    <template #floating>
      <PingoDock v-if="user?.is_platform_administrator" area="platform" />
    </template>
  </AppShell>
</template>
