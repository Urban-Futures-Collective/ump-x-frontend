// Revoke a platform role. Platform admins only, allowlisted roles only.
//
// A role the account has through the default roles is revoked by unpacking the default
// role (see server/utils/realmRoles.ts). A role that comes from anywhere else (a group,
// another composite) can only be changed in the Keycloak admin console.
export default defineEventHandler(async (event) => {
  const caller = await requireRole(event, ROLE_PLATFORM_ADMIN)
  const id = userIdFrom(event)
  const role = await platformRoleFrom(event)

  // Removing your own admin role could leave UMP-X without any platform admin, so that
  // is only possible in the Keycloak admin console.
  if (role === ROLE_PLATFORM_ADMIN && id === caller.sub) {
    throw createError({ statusCode: 409, statusMessage: 'Die eigene Admin-Rolle lässt sich hier nicht entziehen.' })
  }

  const [direct, defaultRole] = await Promise.all([
    keycloakAdmin<RoleRep[]>(`/users/${id}/role-mappings/realm`),
    realmDefaultRole(),
  ])
  const directRole = direct.find(r => r.name === role)
  const composites = direct.some(r => r.id === defaultRole.id) ? await compositesOf(defaultRole) : []
  const viaDefault = composites.some(r => !r.clientRole && r.name === role)

  if (!directRole && !viaDefault) {
    throw createError({ statusCode: 409, statusMessage: 'Die Rolle ist nicht am Konto selbst vergeben und lässt sich nur in der Keycloak-Konsole ändern.' })
  }

  if (directRole) {
    await keycloakAdmin(`/users/${id}/role-mappings/realm`, { method: 'DELETE', body: [{ id: directRole.id, name: directRole.name }] })
  }
  if (viaDefault) {
    await unpackDefaultRole(id, defaultRole, composites, role)
    console.info(`[admin] ${caller.sub} löst die Standardrollen von ${id} auf`)
  }

  console.info(`[admin] ${caller.sub} entzieht ${role} von ${id}`)
  return { ok: true }
})
