import type { RegistryModel } from '~/types/registry'

// Asking for access to a model (design C1, UMP access requests). UMP stores the request;
// the grant itself is the Keycloak role `{server}:{process}` or `{server}`, which an
// access admin gives in the access manager.

export interface ApiAccessRequest {
  id: string
  status: string
  user: { sub: string }
  model: { id: string }
  request_note?: string | null
  status_note?: string | null
  created_at?: string | null
  status_changed_at?: string | null
}

export type AccessState =
  /** Nothing to show: open to everyone, own model, not published, or access held. */
  | { kind: 'none' }
  /** Not signed in: requesting starts with signing in. */
  | { kind: 'login' }
  | { kind: 'request', denied?: string }
  | { kind: 'pending', requestId: string }
  /** Granted, but the session still has the old roles until the next sign-in. */
  | { kind: 'granted' }

/** Same check as UMP's holds_access: the server role or the model role. */
export function holdsAccess(card: Pick<RegistryModel, 'serverName' | 'remoteProcessId'>, roles: string[]) {
  return roles.includes(card.serverName) || roles.includes(`${card.serverName}:${card.remoteProcessId}`)
}

export function accessState(input: {
  card: Pick<RegistryModel, 'id' | 'status' | 'anonymousAccess' | 'ownerSub' | 'serverName' | 'remoteProcessId'>
  loggedIn: boolean
  roles: string[]
  mySub: string
  /** The caller's requests for this model, any order. */
  requests: ApiAccessRequest[]
}): AccessState {
  const { card, loggedIn, roles, mySub } = input
  if (card.status !== 'published' || card.anonymousAccess) return { kind: 'none' }
  if (!loggedIn) return { kind: 'login' }
  if (card.ownerSub === mySub || holdsAccess(card, roles)) return { kind: 'none' }

  const mine = input.requests
    .filter(r => r.user.sub === mySub && r.model.id === card.id)
    .sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''))
  const latest = mine[0]
  if (latest?.status === 'requested') return { kind: 'pending', requestId: latest.id }
  if (latest?.status === 'granted') return { kind: 'granted' }
  if (latest?.status === 'denied') return { kind: 'request', denied: latest.status_note ?? '' }
  return { kind: 'request' }
}
