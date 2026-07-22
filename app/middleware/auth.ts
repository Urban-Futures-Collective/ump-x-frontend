// Named Route-Middleware: schützt Routen, die einen eingeloggten User brauchen (/jobs, /admin).
// Bewusst NICHT global — /, /models, /run bleiben öffentlich (anonymer Katalog/Ausführung).
// Aktiviert per definePageMeta({ middleware: ['auth'] }) in der jeweiligen Page.
export default defineNuxtRouteMiddleware((to) => {
  const { loggedIn } = useOidcAuth()
  if (loggedIn.value) return
  // Ohne Session zurück zur Landing; Ziel als Query, damit später dorthin zurückgeführt
  // werden kann (Login-Flow läuft server-seitig über nuxt-oidc-auth).
  return navigateTo({ path: '/', query: { redirect: to.fullPath } })
})
