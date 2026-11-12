// Give an account access to a model or a whole model server.
export default defineEventHandler(async (event) => {
  const caller = await requireRole(event, ROLE_ACCESS_ADMIN)
  const { role, userId } = await grantFrom(event)

  // Keycloak needs both id and name of the role.
  const rep = await keycloakAdmin<RoleRep>(`/roles/${encodeURIComponent(role)}`)
  await keycloakAdmin(`/users/${userId}/role-mappings/realm`, { method: 'POST', body: [{ id: rep.id, name: rep.name }] })

  // Keycloak records admin events under the service account; this line names the person.
  console.info(`[access] ${caller.sub} vergibt ${role} an ${userId}`)
  return { ok: true }
})
