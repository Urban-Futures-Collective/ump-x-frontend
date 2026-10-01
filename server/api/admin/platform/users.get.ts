// List user accounts, one page at a time, with the total for the pagination and the
// non-default platform roles of each account. Read-only, platform admins only.
interface KeycloakUser {
  id: string
  username: string
  email?: string
  firstName?: string
  lastName?: string
  enabled: boolean
  createdTimestamp?: number
}

// Upper bound for the members of one role. These roles are held by few people; if one
// ever has more, its badges are missing for the rest, nothing else breaks.
const MAX_ROLE_MEMBERS = 1000

// Who holds a role directly. Keycloak does not return roles with the user list, so one
// request per role replaces one request per account. Only direct assignments count; a
// role received through a group would not show here (no groups are used so far).
async function membersOf(role: PlatformRole): Promise<Set<string>> {
  try {
    const users = await keycloakAdmin<{ id: string }[]>(`/roles/${role}/users`, {
      query: { first: 0, max: MAX_ROLE_MEMBERS, briefRepresentation: true },
    })
    return new Set(users.map(u => u.id))
  }
  catch (e) {
    // A role missing in this realm means nobody holds it, not a broken list.
    if ((e as { statusCode?: number }).statusCode === 404) return new Set()
    throw e
  }
}

export default defineEventHandler(async (event) => {
  const caller = await requireRole(event, ROLE_PLATFORM_ADMIN)

  const q = getQuery(event)
  const searchTerm = typeof q.search === 'string' ? q.search.slice(0, 100) : ''
  const firstIndex = Math.max(0, Number(q.first) || 0)
  const pageSize = Math.min(100, Math.max(1, Number(q.max) || 25))

  const [users, total, ...members] = await Promise.all([
    keycloakAdmin<KeycloakUser[]>('/users', {
      query: { search: searchTerm, first: firstIndex, max: pageSize, briefRepresentation: true },
    }),
    keycloakAdmin<number>('/users/count', { query: { search: searchTerm } }),
    ...BADGE_ROLES.map(membersOf),
  ])

  // Keycloak records admin events under the service account, so this log line is the
  // only record of which person made the request.
  console.info(`[admin] ${caller.sub} listet Nutzer (search="${searchTerm}", first=${firstIndex}, max=${pageSize})`)

  const accounts = users
    // Service accounts are technical accounts, not people. They are still part of the
    // count, so a page can be one row short.
    .filter(u => !u.username.startsWith('service-account-'))
    .map(u => ({
      id: u.id,
      username: u.username,
      email: u.email ?? null,
      firstName: u.firstName ?? null,
      lastName: u.lastName ?? null,
      enabled: u.enabled,
      createdTimestamp: u.createdTimestamp ?? null,
      roles: BADGE_ROLES.filter((_, i) => members[i]!.has(u.id)),
    }))

  return { accounts, total }
})
