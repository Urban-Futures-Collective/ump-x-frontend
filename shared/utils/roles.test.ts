import { describe, expect, it } from 'vitest'
import { ADMIN_ROLES, PLATFORM_ROLES, rolesOfSession } from './roles'

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
