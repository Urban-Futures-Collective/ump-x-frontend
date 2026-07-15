// Named Route-Middleware: schützt /admin. Läuft NACH 'auth' (Reihenfolge in definePageMeta),
// prüft also nur noch die Rolle. Ohne ump_admin (bzw. Dev-Override) → zurück zum Katalog.
// Solange die ump_admin-Rolle + Roles-Mapper in Keycloak fehlen, ist /admin für alle
// gesperrt außer per devForceAdmin (siehe useUmpRoles / model-access-admin-decision.md).
export default defineNuxtRouteMiddleware(() => {
  const { isAdmin } = useUmpRoles()
  if (isAdmin.value) return
  return navigateTo('/models')
})
