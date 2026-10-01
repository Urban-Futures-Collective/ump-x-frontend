// The six platform roles of an account: effective or not, assigned directly, via the
// default roles, or from elsewhere. Platform admins only.
export default defineEventHandler(async (event) => {
  await requireRole(event, ROLE_PLATFORM_ADMIN)
  const id = userIdFrom(event)

  const [direct, effective, defaultRole] = await Promise.all([
    keycloakAdmin<RoleRep[]>(`/users/${id}/role-mappings/realm`),
    keycloakAdmin<RoleRep[]>(`/users/${id}/role-mappings/realm/composite`),
    realmDefaultRole(),
  ])
  const fromDefault = direct.some(r => r.id === defaultRole.id)
    ? (await compositesOf(defaultRole)).filter(r => !r.clientRole).map(r => r.name)
    : []
  return platformRoleStatus(direct.map(r => r.name), effective.map(r => r.name), fromDefault)
})
