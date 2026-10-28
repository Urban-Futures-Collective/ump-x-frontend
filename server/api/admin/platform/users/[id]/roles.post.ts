// Assign a platform role. Platform admins only, allowlisted roles only.
export default defineEventHandler(async (event) => {
  const caller = await requireRole(event, ROLE_PLATFORM_ADMIN)
  const id = userIdFrom(event)
  const role = await platformRoleFrom(event)

  // Keycloak needs both id and name of the role, so look it up first (under its new or
  // old name, see findRealmRole).
  const rep = await findRealmRole(role)
  if (!rep) throw createError({ statusCode: 404, statusMessage: `Die Rolle ${role} gibt es im Realm nicht.` })
  await keycloakAdmin(`/users/${id}/role-mappings/realm`, { method: 'POST', body: [{ id: rep.id, name: rep.name }] })

  console.info(`[admin] ${caller.sub} vergibt ${role} an ${id}`)
  return { ok: true }
})
