// Named Route-Middleware: schützt /admin. Läuft NACH 'auth' (Reihenfolge in definePageMeta),
// prüft also nur noch die Rolle. Ohne ump_admin → zurück zum Katalog.
// Die Rolle kommt aus dem Keycloak-Token (siehe useUmpRoles / model-access-admin-decision.md).
export default defineNuxtRouteMiddleware(() => {
  const { isAdmin } = useUmpRoles()
  if (isAdmin.value) return
  return navigateTo('/models')
})
