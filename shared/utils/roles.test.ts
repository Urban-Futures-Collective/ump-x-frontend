import { describe, expect, it } from 'vitest'
import { ADMIN_ROLES, PLATFORM_ROLES, isPlatformRole, platformRoleStatus, rolesOfSession } from './roles'

describe('rolesOfSession', () => {
  it('vereinigt Realm- und ump-client-Rollen aus claims und userInfo', () => {
    const session = {
      claims: { realm_access: { roles: ['user_role_user', 'modelserver-1'] } },
      userInfo: {
        realm_access: { roles: ['user_role_user'] },
        resource_access: { 'ump-client': { roles: ['bikebox-modelserver'] }, 'account': { roles: ['manage-account'] } },
      },
    }
    expect(rolesOfSession(session).sort()).toEqual(['bikebox-modelserver', 'modelserver-1', 'user_role_user'])
  })

  it('gibt ohne Sitzung nichts', () => {
    expect(rolesOfSession(null)).toEqual([])
    expect(rolesOfSession({})).toEqual([])
  })
})

describe('Vokabular', () => {
  it('die Admin-Rollen sind Plattformrollen', () => {
    for (const r of ADMIN_ROLES) expect(PLATFORM_ROLES).toContain(r)
  })

  it('alle Rollen in der Schreibweise user_role_ mit Unterstrichen', () => {
    for (const r of PLATFORM_ROLES) expect(r).toMatch(/^user_role_[a-z_]+$/)
  })
})

describe('platformRoleStatus', () => {
  it('unterscheidet direkt vergebene und über Standardrollen wirksame Rollen', () => {
    const status = platformRoleStatus(
      ['default-roles-urbanmodelplatform', 'user_role_platform_admin'],
      ['default-roles-urbanmodelplatform', 'user_role_viewer', 'user_role_user', 'user_role_provider', 'user_role_platform_admin', 'offline_access'],
    )
    expect(status.find(s => s.role === 'user_role_platform_admin')).toEqual({ role: 'user_role_platform_admin', wirksam: true, direkt: true })
    expect(status.find(s => s.role === 'user_role_user')).toEqual({ role: 'user_role_user', wirksam: true, direkt: false })
    expect(status.find(s => s.role === 'user_role_verifier')).toEqual({ role: 'user_role_verifier', wirksam: false, direkt: false })
    expect(status).toHaveLength(6)
  })
})

describe('isPlatformRole', () => {
  it('lässt nur die sechs Plattformrollen durch', () => {
    expect(isPlatformRole('user_role_verifier')).toBe(true)
    for (const r of ['default-roles-urbanmodelplatform', 'offline_access', 'realm-admin', 'bikebox-modelserver', 'User_Role_User', '', 42]) {
      expect(isPlatformRole(r)).toBe(false)
    }
  })
})
