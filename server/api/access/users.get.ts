// Account search for "Add access": name, username or email, a few hits only.
export default defineEventHandler(async (event) => {
  await requireRole(event, ROLE_ACCESS_ADMIN)
  const q = getQuery(event)
  const search = typeof q.search === 'string' ? q.search.trim().slice(0, 100) : ''
  if (search.length < 2) return []
  const users = await keycloakAdmin<{ id: string, username: string, firstName?: string, lastName?: string, email?: string }[]>('/users', {
    query: { search, first: 0, max: 10, briefRepresentation: true },
  })
  return users.filter(isPerson).map(toAccessUser)
})
