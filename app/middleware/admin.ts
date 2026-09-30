// Named route middleware protecting /admin. Runs AFTER 'auth' (order in definePageMeta),
// so it only checks the role; without an admin role it redirects to the catalog.
// Roles come from the Keycloak token (see useUmpRoles).
export default defineNuxtRouteMiddleware(() => {
  const { isAdmin } = useUmpRoles()
  if (isAdmin.value) return
  return navigateTo('/commons')
})
