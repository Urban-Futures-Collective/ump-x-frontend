// Named route middleware for routes that need a signed-in user (/jobs, /admin).
// Deliberately not global: /, /commons and /run stay public (anonymous catalog and runs).
// Enabled per page via definePageMeta({ middleware: ['auth'] }).
export default defineNuxtRouteMiddleware((to) => {
  const { loggedIn } = useOidcAuth()
  if (loggedIn.value) return
  // Without a session, back to the landing page; the target goes into the query so the
  // user can be sent back after login (the login flow runs server-side in nuxt-oidc-auth).
  return navigateTo({ path: '/', query: { redirect: to.fullPath } })
})
