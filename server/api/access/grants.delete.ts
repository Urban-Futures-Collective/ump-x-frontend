// Take away an account's access to a model or a whole model server. Only the role named
// is removed: access through the server role stays when a model role is revoked.
export default defineEventHandler(async (event) => {
  const caller = await requireRole(event, ROLE_ACCESS_ADMIN)
  const { role, userId } = await grantFrom(event)

  const rep = await keycloakAdmin<RoleRep>(`/roles/${encodeURIComponent(role)}`)
  await keycloakAdmin(`/users/${userId}/role-mappings/realm`, { method: 'DELETE', body: [{ id: rep.id, name: rep.name }] })

  console.info(`[access] ${caller.sub} entzieht ${role} von ${userId}`)
  return { ok: true }
})
