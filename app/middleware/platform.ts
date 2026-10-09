// Navigation convenience only. Laravel authorizes platform operations; Nitro verifies master access before delivering the private change log.
export default defineNuxtRouteMiddleware(async () => {
  const session = useSession()
  if (!(await session.ensureSession())) return navigateTo('/plataforma/login')
  if (!session.user.value?.is_platform_administrator)
    return navigateTo('/plataforma/acesso-negado')
})
