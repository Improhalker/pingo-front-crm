<script setup lang="ts">
import { companyNavigation } from '~/config/navigation'
import { Alert, AlertDescription } from '~/components/ui/alert'

const { user, organization, error, logout } = useSession()
const route = useRoute()
const leaving = ref(false)
const logoutError = ref('')
const roleLabel = computed(() =>
  !organization.value
    ? 'Nenhuma organização aberta'
    : organization.value.role === 'ADMIN'
      ? 'Administrador desta organização'
      : 'Operador desta organização',
)
async function leave() {
  if (leaving.value) return
  leaving.value = true
  logoutError.value = ''
  try {
    await logout()
  } catch {
    logoutError.value = 'Não foi possível encerrar a sessão. Tente novamente.'
  } finally {
    leaving.value = false
  }
}
</script>

<template>
  <AppShell
    :sections="companyNavigation"
    area-label="Espaço da empresa"
    home-to="/"
  >
    <template #note>Seu financeiro em dia,<br />sem complicação.</template>
    <template #actions>
      <AppOrganizationName v-if="user && !user.is_platform_administrator" />
      <AppAccountMenu
        v-if="user"
        :name="user.name"
        :email="user.email"
        :role="roleLabel"
        :leaving="leaving"
        @logout="leave"
      />
    </template>
    <Alert v-if="logoutError || error" variant="destructive" role="alert">
      <AlertDescription>{{ logoutError || error }}</AlertDescription>
    </Alert>
    <slot />
    <template #floating>
      <PingoDock
        v-if="organization && route.path !== '/assistente'"
        area="company"
      />
    </template>
  </AppShell>
</template>
