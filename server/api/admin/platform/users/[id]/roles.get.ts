// Die sechs Plattformrollen eines Kontos: wirksam oder nicht, direkt vergeben oder
// über die Standardrollen. Nur für platform admins.
interface RoleRep { id: string, name: string }

export default defineEventHandler(async (event) => {
  await requireRole(event, ROLE_PLATFORM_ADMIN)
  const id = nutzerIdAus(event)

  const [direkt, wirksam] = await Promise.all([
    keycloakAdmin<RoleRep[]>(`/users/${id}/role-mappings/realm`),
    keycloakAdmin<RoleRep[]>(`/users/${id}/role-mappings/realm/composite`),
  ])
  return platformRoleStatus(direkt.map(r => r.name), wirksam.map(r => r.name))
})
