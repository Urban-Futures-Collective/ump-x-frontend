// Eine Plattformrolle vergeben. Nur für platform admins, nur aus der Allowlist.
interface RoleRep { id: string, name: string }

export default defineEventHandler(async (event) => {
  const aufrufer = await requireRole(event, ROLE_PLATFORM_ADMIN)
  const id = nutzerIdAus(event)
  const role = await plattformRolleAus(event)

  // Keycloak will beim Zuweisen id UND name der Rolle, also erst nachschlagen.
  const rep = await keycloakAdmin<RoleRep>(`/roles/${encodeURIComponent(role)}`)
  await keycloakAdmin(`/users/${id}/role-mappings/realm`, { method: 'POST', body: [{ id: rep.id, name: rep.name }] })

  console.info(`[admin] ${aufrufer.sub} vergibt ${role} an ${id}`)
  return { ok: true }
})
