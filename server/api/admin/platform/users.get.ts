// List user accounts. Read-only, platform admins only.
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
  const caller = await requireRole(event, ROLE_PLATFORM_ADMIN)

  const q = getQuery(event)
  const searchTerm = typeof q.search === 'string' ? q.search.slice(0, 100) : ''
  const firstIndex = Math.max(0, Number(q.first) || 0)
  const pageSize = Math.min(100, Math.max(1, Number(q.max) || 50))

  const users = await keycloakAdmin<KeycloakUser[]>('/users', {
    query: { search: searchTerm, first: firstIndex, max: pageSize, briefRepresentation: true },
  })

  // Keycloak records admin events under the service account, so this log line is the
  // only record of which person made the request.
  console.info(`[admin] ${caller.sub} listet Nutzer (search="${searchTerm}", first=${firstIndex}, max=${pageSize})`)

  return users
    // Service accounts are technical accounts, not people.
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
