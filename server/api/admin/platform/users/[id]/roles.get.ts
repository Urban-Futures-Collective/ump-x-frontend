// The six platform roles of an account: effective or not, assigned directly or via the
// default roles. Platform admins only.
interface RoleRep { id: string, name: string }

export default defineEventHandler(async (event) => {
  await requireRole(event, ROLE_PLATFORM_ADMIN)
  const id = userIdFrom(event)

  const [direct, effective] = await Promise.all([
    keycloakAdmin<RoleRep[]>(`/users/${id}/role-mappings/realm`),
    keycloakAdmin<RoleRep[]>(`/users/${id}/role-mappings/realm/composite`),
  ])
  return platformRoleStatus(direct.map(r => r.name), effective.map(r => r.name))
})
