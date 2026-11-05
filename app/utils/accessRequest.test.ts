import { describe, expect, it } from 'vitest'
import type { ApiAccessRequest } from './accessRequest'
import { accessState, holdsAccess, runAccess, serverOf } from './accessRequest'

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
    expect(accessState({ ...base, roles: ['verifier'] }).kind).toBe('none')
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

describe('run access', () => {
  const pub = { status: 'published' as const, anonymousAccess: false, serverName: 'bikebox', remoteProcessId: 'growbike' }

  it('does not block without a card', () => {
    expect(runAccess(undefined, false, [])).toBe('unknown')
  })

  it('lets everyone run an open model', () => {
    expect(runAccess({ ...pub, anonymousAccess: true }, false, [])).toBe('allowed')
  })

  it('asks anonymous callers to sign in', () => {
    expect(runAccess(pub, false, [])).toBe('login')
  })

  it('needs the server role, the model role or the verifier role', () => {
    expect(runAccess(pub, true, [])).toBe('locked')
    expect(runAccess(pub, true, ['bikebox'])).toBe('allowed')
    expect(runAccess(pub, true, ['bikebox:growbike'])).toBe('allowed')
    expect(runAccess(pub, true, ['verifier'])).toBe('allowed')
  })

  it('keeps models under review to verifiers, even open ones', () => {
    const review = { ...pub, status: 'in_review' as const, anonymousAccess: true }
    expect(runAccess(review, true, ['verifier'])).toBe('allowed')
    expect(runAccess(review, true, ['bikebox'])).toBe('locked')
    expect(runAccess(review, false, [])).toBe('login')
  })
})

describe('serverOf', () => {
  it('takes the server from a model role', () => {
    expect(serverOf({ role: 'bikebox:fixbike' })).toBe('bikebox')
  })
  it('keeps a role without a process', () => {
    expect(serverOf({ role: 'bikebox' })).toBe('bikebox')
  })
})
