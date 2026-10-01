// Realm role lookups shared by the admin routes: who holds a role, and the realm's
// default role.
//
// New accounts do not get Viewer, User and Provider one by one. Keycloak gives them the
// realm's default role (`default-roles-<realm>`), a composite that contains these three
// plus Keycloak's own (offline_access, uma_authorization, account console roles). To take
// one of the three away from a single account, the default role is "unpacked": the
// account gets every part of it directly except the one being removed, then loses the
// default role. Later changes to the default roles no longer reach such an account.

export interface RoleRep { id: string, name: string, clientRole?: boolean, containerId?: string }

// Page size when reading role members. The default role is held by every account, so
// its members are read page by page rather than with one capped request.
const MEMBERS_PAGE = 500

// IDs of the accounts that hold a role directly. Roles received through a group or
// another composite are not included (no groups are used so far).
export async function membersOf(roleName: string): Promise<Set<string>> {
  const ids = new Set<string>()
  for (let first = 0; ; first += MEMBERS_PAGE) {
    let page: { id: string }[]
    try {
      page = await keycloakAdmin<{ id: string }[]>(`/roles/${encodeURIComponent(roleName)}/users`, {
        query: { first, max: MEMBERS_PAGE, briefRepresentation: true },
      })
    }
    catch (e) {
      // A role missing in this realm means nobody holds it, not a broken list.
      if ((e as { statusCode?: number }).statusCode === 404) return ids
      throw e
    }
    for (const u of page) ids.add(u.id)
    if (page.length < MEMBERS_PAGE) return ids
  }
}

export async function realmDefaultRole(): Promise<RoleRep> {
  const realm = await keycloakAdmin<{ defaultRole: RoleRep }>('')
  return realm.defaultRole
}

export async function compositesOf(role: RoleRep): Promise<RoleRep[]> {
  return keycloakAdmin<RoleRep[]>(`/roles-by-id/${role.id}/composites`)
}

// Replace the default role on an account by its parts, minus `without`. The parts are
// assigned before the default role is removed, so the account never has fewer roles in
// between than it should end up with.
export async function unpackDefaultRole(userId: string, defaultRole: RoleRep, composites: RoleRep[], without: string) {
  const realmRoles = composites.filter(r => !r.clientRole && r.name !== without)
  if (realmRoles.length) {
    await keycloakAdmin(`/users/${userId}/role-mappings/realm`, { method: 'POST', body: realmRoles })
  }

  const byClient = new Map<string, RoleRep[]>()
  for (const r of composites.filter(r => r.clientRole && r.containerId)) {
    byClient.set(r.containerId!, [...(byClient.get(r.containerId!) ?? []), r])
  }
  for (const [clientId, roles] of byClient) {
    await keycloakAdmin(`/users/${userId}/role-mappings/clients/${clientId}`, { method: 'POST', body: roles })
  }

  await keycloakAdmin(`/users/${userId}/role-mappings/realm`, { method: 'DELETE', body: [{ id: defaultRole.id, name: defaultRole.name }] })
}
