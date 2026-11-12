import { describe, expect, it, vi } from 'vitest'
import { rolesFrom } from '../../shared/utils/roles'

vi.stubGlobal('rolesFrom', rolesFrom)
const { tokenClaims, tokenRoles } = await import('./tokenRoles')

const jwt = (payload: object) => `h.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.s`

describe('tokenRoles', () => {
  it('reads realm and client roles of the current token', () => {
    const token = jwt({ sub: 'a', realm_access: { roles: ['user'] }, resource_access: { 'ump-client': { roles: ['modelserver'] } } })
    expect(tokenRoles(token).sort()).toEqual(['modelserver', 'user'])
  })

  it('knows nothing of roles that are no longer in the token', () => {
    expect(tokenRoles(jwt({ realm_access: { roles: ['user'] } }))).not.toContain('platform-admin')
  })

  it('has no roles without a readable token', () => {
    expect(tokenRoles(undefined)).toEqual([])
    expect(tokenRoles('not-a-token')).toEqual([])
    expect(tokenRoles('a.%%%.c')).toEqual([])
    expect(tokenClaims(null)).toEqual({})
  })
})
