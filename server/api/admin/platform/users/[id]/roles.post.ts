// Assign a platform role. Platform admins only, allowlisted roles only.
interface RoleRep { id: string, name: string }

export default defineEventHandler(async (event) => {
  const aufrufer = await requireRole(event, ROLE_PLATFORM_ADMIN)
  const id = nutzerIdAus(event)
  const role = await plattformRolleAus(event)

  // Keycloak needs both id and name of the role, so look it up first.
  const rep = await keycloakAdmin<RoleRep>(`/roles/${encodeURIComponent(role)}`)
  await keycloakAdmin(`/users/${id}/role-mappings/realm`, { method: 'POST', body: [{ id: rep.id, name: rep.name }] })

  console.info(`[admin] ${aufrufer.sub} vergibt ${role} an ${id}`)
  return { ok: true }
})
