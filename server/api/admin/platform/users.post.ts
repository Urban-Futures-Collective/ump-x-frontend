// Create an account and send the invitation email. Platform admins only.
//
// The account is created enabled, without password and with the email unverified; the
// invitation lets the person set both. If creating works but sending fails, the account
// stays and the response says so, so the invitation can be sent again from the list.
interface KeycloakUser { id: string, username: string }

export default defineEventHandler(async (event) => {
  const caller = await requireRole(event, ROLE_PLATFORM_ADMIN)
  const checked = checkNewAccount(await readBody(event).catch(() => null))
  if (!checked.account) {
    throw createError({ statusCode: 400, statusMessage: `Ungültige Angaben: ${checked.problems.join(', ')}`, data: { problems: checked.problems } })
  }
  const account = checked.account

  try {
    await keycloakAdmin('/users', {
      method: 'POST',
      body: { ...account, enabled: true, emailVerified: false },
    })
  }
  catch (e) {
    if ((e as { statusCode?: number }).statusCode === 409) {
      throw createError({ statusCode: 409, statusMessage: 'Nutzername oder E-Mail ist bereits vergeben.' })
    }
    throw e
  }

  // Keycloak answers 201 with the new id only in the Location header; look it up by
  // the exact username instead.
  const [created] = await keycloakAdmin<KeycloakUser[]>('/users', {
    query: { username: account.username, exact: true },
  })
  if (!created) {
    throw createError({ statusCode: 502, statusMessage: 'Konto angelegt, aber nicht wiedergefunden.' })
  }
  console.info(`[admin] ${caller.sub} legt Konto ${created.id} (${account.username}) an`)

  try {
    await sendInvitation(created.id)
  }
  catch {
    console.warn(`[admin] Einladung an ${created.id} konnte nicht gesendet werden`)
    return { id: created.id, invited: false }
  }
  console.info(`[admin] ${caller.sub} lädt ${created.id} ein`)
  return { id: created.id, invited: true }
})
