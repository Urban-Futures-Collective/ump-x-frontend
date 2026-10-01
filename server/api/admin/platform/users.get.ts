// List user accounts, one page at a time, with the total for the pagination, the
// non-default platform roles of each account and the default roles it lacks. Read-only,
// platform admins only.
//
// Keycloak does not return roles with the user list, so role membership is read once per
// role rather than once per account (see server/utils/realmRoles.ts).
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
  const pageSize = Math.min(100, Math.max(1, Number(q.max) || 25))

  const [users, total, defaultMembers, ...members] = await Promise.all([
    keycloakAdmin<KeycloakUser[]>('/users', {
      query: { search: searchTerm, first: firstIndex, max: pageSize, briefRepresentation: true },
    }),
    keycloakAdmin<number>('/users/count', { query: { search: searchTerm } }),
    realmDefaultRole().then(r => membersOf(r.name)),
    ...BADGE_ROLES.map(membersOf),
  ])

  // Keycloak records admin events under the service account, so this log line is the
  // only record of which person made the request.
  console.info(`[admin] ${caller.sub} listet Nutzer (search="${searchTerm}", first=${firstIndex}, max=${pageSize})`)

  // Service accounts are technical accounts, not people. They are still part of the
  // count, so a page can be one row short.
  const people = users.filter(u => !u.username.startsWith('service-account-'))

  // Accounts without the default role were unpacked (see roles.delete.ts) and hold the
  // default roles directly, or not at all. Only then is it worth asking who holds them.
  const unpacked = people.some(u => !defaultMembers.has(u.id))
  const defaultRoleMembers = unpacked ? await Promise.all(DEFAULT_ROLES.map(membersOf)) : []

  const accounts = people.map(u => ({
    id: u.id,
    username: u.username,
    email: u.email ?? null,
    firstName: u.firstName ?? null,
    lastName: u.lastName ?? null,
    enabled: u.enabled,
    createdTimestamp: u.createdTimestamp ?? null,
    roles: BADGE_ROLES.filter((_, i) => members[i]!.has(u.id)),
    missing: defaultMembers.has(u.id) ? [] : DEFAULT_ROLES.filter((_, i) => !defaultRoleMembers[i]!.has(u.id)),
  }))

  return { accounts, total }
})
