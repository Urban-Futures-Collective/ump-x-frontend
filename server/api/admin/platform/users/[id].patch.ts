// Enable or disable an account. Platform admins only.
//
// Disabling in Keycloak only stops new tokens; tokens already issued stay valid until
// they expire, so all of the user's sessions are ended as well. Admins cannot disable
// their own account, so they cannot lock themselves out.
export default defineEventHandler(async (event) => {
  const caller = await requireRole(event, ROLE_PLATFORM_ADMIN)
  const id = userIdFrom(event)
  const body = await readBody<{ enabled?: unknown }>(event).catch(() => null)
  if (typeof body?.enabled !== 'boolean') {
    throw createError({ statusCode: 400, statusMessage: 'Erwartet wird { enabled: true | false }.' })
  }
  const enable = body.enabled

  if (!enable && id === caller.sub) {
    throw createError({ statusCode: 409, statusMessage: 'Das eigene Konto lässt sich hier nicht deaktivieren.' })
  }

  // Keycloak's PUT only updates the fields that are sent.
  await keycloakAdmin(`/users/${id}`, { method: 'PUT', body: { enabled: enable } })
  if (!enable) {
    await keycloakAdmin(`/users/${id}/logout`, { method: 'POST' })
  }

  console.info(`[admin] ${caller.sub} ${enable ? 'aktiviert' : 'deaktiviert'} Konto ${id}`)
  return { ok: true, enabled: enable }
})
