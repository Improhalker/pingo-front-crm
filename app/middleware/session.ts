// Only requires a signed-in account, without opening a company (development diagnostics).
export default defineNuxtRouteMiddleware(async () => {
  if (!(await useSession().ensureSession())) return navigateTo('/login')
})
