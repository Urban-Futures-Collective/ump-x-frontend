import { describe, expect, it } from 'vitest'
import { ADMIN_ROLES, PLATFORM_ROLES, isPlatformRole, platformRoleStatus, rolesOfSession } from './roles'

describe('rolesOfSession', () => {
  it('merges realm and ump-client roles from claims and userInfo', () => {
    const session = {
      claims: { realm_access: { roles: ['user', 'modelserver-1'] } },
      userInfo: {
        realm_access: { roles: ['user'] },
        resource_access: { 'ump-client': { roles: ['bikebox-modelserver'] }, 'account': { roles: ['manage-account'] } },
      },
    }
    expect(rolesOfSession(session).sort()).toEqual(['bikebox-modelserver', 'modelserver-1', 'user'])
  })

  it('returns nothing without a session', () => {
    expect(rolesOfSession(null)).toEqual([])
    expect(rolesOfSession({})).toEqual([])
  })
})

describe('vocabulary', () => {
  it('the admin roles are platform roles', () => {
    for (const r of ADMIN_ROLES) expect(PLATFORM_ROLES).toContain(r)
  })

  it('uses the names UMP checks', () => {
    expect([...PLATFORM_ROLES].sort()).toEqual(['access-admin', 'platform-admin', 'provider', 'user', 'verifier', 'viewer'])
  })

  it('no longer reads the old realm names', () => {
    expect(rolesOfSession({ claims: { realm_access: { roles: ['user_role_verifier', 'platform-admin'] } } }).sort()).toEqual(['platform-admin', 'user_role_verifier'])
  })
})

describe('platformRoleStatus', () => {
  it('distinguishes directly assigned roles from roles effective via default roles', () => {
    const status = platformRoleStatus(
      ['default-roles-urbanmodelplatform', 'platform-admin'],
      ['default-roles-urbanmodelplatform', 'viewer', 'user', 'provider', 'platform-admin', 'offline_access'],
      ['viewer', 'user', 'provider', 'offline_access'],
    )
    expect(status.find(s => s.role === 'platform-admin')).toEqual({ role: 'platform-admin', effective: true, direct: true, viaDefault: false })
    expect(status.find(s => s.role === 'user')).toEqual({ role: 'user', effective: true, direct: false, viaDefault: true })
    expect(status.find(s => s.role === 'verifier')).toEqual({ role: 'verifier', effective: false, direct: false, viaDefault: false })
    expect(status).toHaveLength(6)
  })

  it('marks a role effective from elsewhere as neither direct nor via the default roles', () => {
    const status = platformRoleStatus(['some-group-composite'], ['some-group-composite', 'verifier'], [])
    expect(status.find(s => s.role === 'verifier')).toEqual({ role: 'verifier', effective: true, direct: false, viaDefault: false })
  })

  it('treats a role assigned directly as direct even if the default roles contain it', () => {
    const status = platformRoleStatus(['viewer'], ['viewer'], ['viewer'])
    expect(status.find(s => s.role === 'viewer')).toMatchObject({ direct: true, viaDefault: false })
  })
})

describe('isPlatformRole', () => {
  it('accepts only the six platform roles', () => {
    expect(isPlatformRole('verifier')).toBe(true)
    expect(isPlatformRole('user_role_verifier')).toBe(false)
    for (const r of ['default-roles-urbanmodelplatform', 'offline_access', 'realm-admin', 'bikebox-modelserver', 'User_Role_User', '', 42]) {
      expect(isPlatformRole(r)).toBe(false)
    }
  })
})
