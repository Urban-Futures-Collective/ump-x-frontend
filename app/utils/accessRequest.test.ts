import { describe, expect, it } from 'vitest'
import type { ApiAccessRequest } from './accessRequest'
import { accessState, holdsAccess } from './accessRequest'

const card = { id: 'm1', status: 'published' as const, anonymousAccess: false, ownerSub: 'owner', serverName: 'bikebox', remoteProcessId: 'growbike' }
const req = (status: string, created: string, extra: Partial<ApiAccessRequest> = {}): ApiAccessRequest =>
  ({ id: `r-${created}`, status, user: { sub: 'me' }, model: { id: 'm1' }, created_at: created, ...extra })
const base = { card, loggedIn: true, roles: [], mySub: 'me', requests: [] as ApiAccessRequest[] }

describe('access requests', () => {
  it('accepts the server role and the model role', () => {
    expect(holdsAccess(card, ['bikebox'])).toBe(true)
    expect(holdsAccess(card, ['bikebox:growbike'])).toBe(true)
    expect(holdsAccess(card, ['bikebox:other', 'growbike'])).toBe(false)
  })

  it('shows nothing where no request is possible', () => {
    expect(accessState({ ...base, card: { ...card, anonymousAccess: true } }).kind).toBe('none')
    expect(accessState({ ...base, card: { ...card, status: 'submitted' } }).kind).toBe('none')
    expect(accessState({ ...base, mySub: 'owner' }).kind).toBe('none')
    expect(accessState({ ...base, roles: ['bikebox'] }).kind).toBe('none')
  })

  it('asks to sign in first', () => {
    expect(accessState({ ...base, loggedIn: false }).kind).toBe('login')
  })

  it('follows the latest own request', () => {
    expect(accessState(base)).toEqual({ kind: 'request' })
    expect(accessState({ ...base, requests: [req('denied', '2026-11-01', { status_note: 'No' }), req('requested', '2026-11-02')] }))
      .toEqual({ kind: 'pending', requestId: 'r-2026-11-02' })
    expect(accessState({ ...base, requests: [req('requested', '2026-11-01'), req('denied', '2026-11-02', { status_note: 'No' })] }))
      .toEqual({ kind: 'request', denied: 'No' })
    expect(accessState({ ...base, requests: [req('granted', '2026-11-02')] }).kind).toBe('granted')
    expect(accessState({ ...base, requests: [req('withdrawn', '2026-11-02')] }).kind).toBe('request')
  })

  it('ignores requests of others', () => {
    expect(accessState({ ...base, requests: [req('requested', '2026-11-02', { user: { sub: 'other' } })] }).kind).toBe('request')
  })
})
