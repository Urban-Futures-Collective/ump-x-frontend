import { describe, expect, it } from 'vitest'
import { ADMIN_ROLES, PLATFORM_ROLES, isPlatformRole, platformRoleStatus, rolesOfSession } from './roles'

describe('rolesOfSession', () => {
  it('merges realm and ump-client roles from claims and userInfo', () => {
    const session = {
      claims: { realm_access: { roles: ['user_role_user', 'modelserver-1'] } },
      userInfo: {
        realm_access: { roles: ['user_role_user'] },
        resource_access: { 'ump-client': { roles: ['bikebox-modelserver'] }, 'account': { roles: ['manage-account'] } },
      },
    }
    expect(rolesOfSession(session).sort()).toEqual(['bikebox-modelserver', 'modelserver-1', 'user_role_user'])
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

  it('all roles are spelled user_role_ with underscores', () => {
    for (const r of PLATFORM_ROLES) expect(r).toMatch(/^user_role_[a-z_]+$/)
  })
})

describe('platformRoleStatus', () => {
  it('distinguishes directly assigned roles from roles effective via default roles', () => {
    const status = platformRoleStatus(
      ['default-roles-urbanmodelplatform', 'user_role_platform_admin'],
      ['default-roles-urbanmodelplatform', 'user_role_viewer', 'user_role_user', 'user_role_provider', 'user_role_platform_admin', 'offline_access'],
    )
    expect(status.find(s => s.role === 'user_role_platform_admin')).toEqual({ role: 'user_role_platform_admin', effective: true, direct: true })
    expect(status.find(s => s.role === 'user_role_user')).toEqual({ role: 'user_role_user', effective: true, direct: false })
    expect(status.find(s => s.role === 'user_role_verifier')).toEqual({ role: 'user_role_verifier', effective: false, direct: false })
    expect(status).toHaveLength(6)
  })
})

describe('isPlatformRole', () => {
  it('accepts only the six platform roles', () => {
    expect(isPlatformRole('user_role_verifier')).toBe(true)
    for (const r of ['default-roles-urbanmodelplatform', 'offline_access', 'realm-admin', 'bikebox-modelserver', 'User_Role_User', '', 42]) {
      expect(isPlatformRole(r)).toBe(false)
    }
  })
})
