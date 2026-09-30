// Nutzerkonten auflisten. Nur lesend, nur für platform admins (F11).
//
// Die erste Admin-Route und bewusst die harmloseste: sie prüft die ganze Kette
// (Sitzung, Rolle, Dienstkonto, Admin-API), ohne etwas zu verändern.
interface KeycloakUser {
  id: string
  username: string
  email?: string
  firstName?: string
  lastName?: string
  enabled: boolean
  createdTimestamp?: number
}

export default defineEventHandler(async (event) => {
  const aufrufer = await requireRole(event, ROLE_PLATFORM_ADMIN)

  const q = getQuery(event)
  const suche = typeof q.search === 'string' ? q.search.slice(0, 100) : ''
  const erster = Math.max(0, Number(q.first) || 0)
  const anzahl = Math.min(100, Math.max(1, Number(q.max) || 50))

  const nutzer = await keycloakAdmin<KeycloakUser[]>('/users', {
    query: { search: suche, first: erster, max: anzahl, briefRepresentation: true },
  })

  // Keycloak führt die Admin-Ereignisse unter dem Dienstkonto. Wer wirklich gefragt
  // hat, steht nur hier (F11, „Where does human admin get recorded?“).
  console.info(`[admin] ${aufrufer.sub} listet Nutzer (search="${suche}", first=${erster}, max=${anzahl})`)

  return nutzer
    // Dienstkonten sind technische Konten, keine Personen, und gehören nicht in die Liste.
    .filter(u => !u.username.startsWith('service-account-'))
    .map(u => ({
      id: u.id,
      username: u.username,
      email: u.email ?? null,
      firstName: u.firstName ?? null,
      lastName: u.lastName ?? null,
      enabled: u.enabled,
      createdTimestamp: u.createdTimestamp ?? null,
    }))
})
