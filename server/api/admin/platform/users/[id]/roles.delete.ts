// Eine direkt vergebene Plattformrolle entziehen. Nur für platform admins, nur aus der
// Allowlist. Rollen, die über die Standardrollen wirken, bleiben davon unberührt.
interface RoleRep { id: string, name: string }

export default defineEventHandler(async (event) => {
  const aufrufer = await requireRole(event, ROLE_PLATFORM_ADMIN)
  const id = nutzerIdAus(event)
  const role = await plattformRolleAus(event)

  // Sich selbst die Admin-Rolle zu nehmen, würde UMP-X womöglich ohne platform admin
  // zurücklassen. Das geht nur in der Keycloak-Konsole (F11).
  if (role === ROLE_PLATFORM_ADMIN && id === aufrufer.sub) {
    throw createError({ statusCode: 409, statusMessage: 'Die eigene Admin-Rolle lässt sich hier nicht entziehen.' })
  }

  const rep = await keycloakAdmin<RoleRep>(`/roles/${encodeURIComponent(role)}`)
  await keycloakAdmin(`/users/${id}/role-mappings/realm`, { method: 'DELETE', body: [{ id: rep.id, name: rep.name }] })

  console.info(`[admin] ${aufrufer.sub} entzieht ${role} von ${id}`)
  return { ok: true }
})
