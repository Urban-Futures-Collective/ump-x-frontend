// Display names for account ids, e.g. the owners in the admin servers list (UMP only
// knows the owner's id). Read-only, platform admins only. Unknown ids are left out.
interface KeycloakUser {
  id: string
  username: string
  firstName?: string
  lastName?: string
}

const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default defineEventHandler(async (event) => {
  await requireRole(event, ROLE_PLATFORM_ADMIN)
  const raw = getQuery(event).ids
  const ids = [...new Set((typeof raw === 'string' ? raw.split(',') : []).filter(id => ID.test(id)))].slice(0, 200)
  const found = await Promise.all(ids.map(id => keycloakAdmin<KeycloakUser>(`/users/${id}`).catch(() => null)))
  return Object.fromEntries(found
    .filter((u): u is KeycloakUser => !!u)
    .map(u => [u.id, [u.firstName, u.lastName].filter(Boolean).join(' ') || u.username]))
})
