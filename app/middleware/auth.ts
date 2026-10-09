// Company routes: the session must exist and the account's single company must open (ADR-028).
// Navigation convenience only; the API authorizes every company request.
export default defineNuxtRouteMiddleware(async () => {
  const state = await useSession().ensureContext()
  if (state === 'signed-out') return navigateTo('/login')
  if (state === 'platform') return navigateTo('/plataforma')
  if (state === 'blocked') return navigateTo('/acesso-indisponivel')
  // 'error' and 'cancelled' continue: the page shows the context gate with a retry.
})
