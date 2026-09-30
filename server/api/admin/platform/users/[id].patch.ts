// Ein Konto aktivieren oder deaktivieren. Nur für platform admins (F11).
//
// Deaktivieren heißt in Keycloak: das Konto bekommt kein neues Token mehr. Ein schon
// ausgestelltes gilt aber bis zu seinem Ablauf weiter, deshalb werden danach alle
// Sitzungen der Person beendet. Das eigene Konto ist ausgenommen, sonst sperrt man
// sich aus.
export default defineEventHandler(async (event) => {
  const aufrufer = await requireRole(event, ROLE_PLATFORM_ADMIN)
  const id = nutzerIdAus(event)
  const body = await readBody<{ enabled?: unknown }>(event).catch(() => null)
  if (typeof body?.enabled !== 'boolean') {
    throw createError({ statusCode: 400, statusMessage: 'Erwartet wird { enabled: true | false }.' })
  }
  const aktiv = body.enabled

  if (!aktiv && id === aufrufer.sub) {
    throw createError({ statusCode: 409, statusMessage: 'Das eigene Konto lässt sich hier nicht deaktivieren.' })
  }

  // Keycloak übernimmt bei PUT nur die mitgeschickten Felder.
  await keycloakAdmin(`/users/${id}`, { method: 'PUT', body: { enabled: aktiv } })
  if (!aktiv) {
    await keycloakAdmin(`/users/${id}/logout`, { method: 'POST' })
  }

  console.info(`[admin] ${aufrufer.sub} ${aktiv ? 'aktiviert' : 'deaktiviert'} Konto ${id}`)
  return { ok: true, enabled: aktiv }
})
