// Revoke a directly assigned platform role. Platform admins only, allowlisted roles only.
// Roles that come from the default roles are not affected.
interface RoleRep { id: string, name: string }

export default defineEventHandler(async (event) => {
  const aufrufer = await requireRole(event, ROLE_PLATFORM_ADMIN)
  const id = nutzerIdAus(event)
  const role = await plattformRolleAus(event)

  // Removing your own admin role could leave UMP-X without any platform admin, so that
  // is only possible in the Keycloak admin console.
  if (role === ROLE_PLATFORM_ADMIN && id === aufrufer.sub) {
    throw createError({ statusCode: 409, statusMessage: 'Die eigene Admin-Rolle lässt sich hier nicht entziehen.' })
  }

  const rep = await keycloakAdmin<RoleRep>(`/roles/${encodeURIComponent(role)}`)
  await keycloakAdmin(`/users/${id}/role-mappings/realm`, { method: 'DELETE', body: [{ id: rep.id, name: rep.name }] })

  console.info(`[admin] ${aufrufer.sub} entzieht ${role} von ${id}`)
  return { ok: true }
})
