// Keycloak calls for the access manager (design A4). Access admins only; every route
// checks the role first and every role name against the catalogue (accessRoles.ts).
import type { H3Event } from 'h3'

export interface AccessUser { id: string, username: string, firstName: string | null, lastName: string | null, email: string | null }

interface KeycloakUser { id: string, username: string, firstName?: string, lastName?: string, email?: string }

const PAGE = 500

export function toAccessUser(u: KeycloakUser): AccessUser {
  return { id: u.id, username: u.username, firstName: u.firstName ?? null, lastName: u.lastName ?? null, email: u.email ?? null }
}

// Service accounts are technical accounts, not people, and never get model access here.
export const isPerson = (u: { username: string }) => !u.username.startsWith('service-account-')

export async function loadAccessCatalog(): Promise<AccessServer[]> {
  const names: string[] = []
  for (let first = 0; ; first += PAGE) {
    const page = await keycloakAdmin<{ name: string }[]>('/roles', { query: { first, max: PAGE, briefRepresentation: true } })
    names.push(...page.map(r => r.name))
    if (page.length < PAGE) return accessCatalog(names)
  }
}

// Accounts holding a role directly, with names for the list.
export async function accessMembers(role: string): Promise<AccessUser[]> {
  const users: AccessUser[] = []
  for (let first = 0; ; first += PAGE) {
    let page: KeycloakUser[]
    try {
      page = await keycloakAdmin<KeycloakUser[]>(`/roles/${encodeURIComponent(role)}/users`, { query: { first, max: PAGE, briefRepresentation: true } })
    }
    catch (e) {
      if ((e as { statusCode?: number }).statusCode === 404) return users
      throw e
    }
    users.push(...page.filter(isPerson).map(toAccessUser))
    if (page.length < PAGE) return users
  }
}

// A role from the query or body, accepted only if it is in the catalogue.
export async function accessRoleFrom(role: unknown): Promise<string> {
  if (typeof role !== 'string' || !isAccessRole(role, await loadAccessCatalog())) {
    throw createError({ statusCode: 400, statusMessage: 'Das ist keine Modellzugriffsrolle.' })
  }
  return role
}

// Role and account for a grant or revoke, both validated.
export async function grantFrom(event: H3Event): Promise<{ role: string, userId: string }> {
  const body = await readBody<{ role?: unknown, userId?: unknown }>(event).catch(() => null)
  const userId = typeof body?.userId === 'string' ? body.userId : ''
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
    throw createError({ statusCode: 400, statusMessage: 'Ungültige Nutzer-ID.' })
  }
  return { role: await accessRoleFrom(body?.role), userId }
}
