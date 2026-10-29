import { describe, expect, it } from 'vitest'
import { accessCatalog, isAccessRole } from './accessRoles'

const realm = [
  'viewer',
  'provider',
  'verifier',
  'access-admin',
  'platform-admin',
  'default-roles-urbanmodelplatform',
  'offline_access',
  'bikebox-modelserver',
  'bikebox-modelserver:growbike',
  'bikebox-modelserver:fixbike',
  'osmnx-modelserver:street-permeability',
  'modelserver_squareroot',
  'verifier:sneaky',
]

describe('accessCatalog', () => {
  it('groups model roles by server, sorted', () => {
    expect(accessCatalog(realm)).toEqual([
      { name: 'bikebox-modelserver', hasRole: true, processes: ['fixbike', 'growbike'] },
      { name: 'osmnx-modelserver', hasRole: false, processes: ['street-permeability'] },
    ])
  })

  it('never treats a platform role as a server', () => {
    expect(accessCatalog(realm).map(s => s.name)).not.toContain('verifier')
  })
})

describe('isAccessRole', () => {
  const catalog = accessCatalog(realm)

  it('allows model roles and existing server roles', () => {
    expect(isAccessRole('bikebox-modelserver:growbike', catalog)).toBe(true)
    expect(isAccessRole('bikebox-modelserver', catalog)).toBe(true)
  })

  it('refuses everything else', () => {
    expect(isAccessRole('osmnx-modelserver', catalog)).toBe(false)
    expect(isAccessRole('platform-admin', catalog)).toBe(false)
    expect(isAccessRole('verifier:sneaky', catalog)).toBe(false)
    expect(isAccessRole('offline_access', catalog)).toBe(false)
    expect(isAccessRole('bikebox-modelserver:other', catalog)).toBe(false)
  })
})
