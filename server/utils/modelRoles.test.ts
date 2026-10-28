import { describe, expect, it } from 'vitest'
import { modelAccessRoleNames } from './modelRoles'

describe('modelAccessRoleNames', () => {
  it('names the server role and the model role', () => {
    expect(modelAccessRoleNames('bikebox-modelserver', 'growbike')).toEqual(['bikebox-modelserver', 'bikebox-modelserver:growbike'])
  })

  it('refuses names that are not plain ids', () => {
    expect(() => modelAccessRoleNames('Bikebox', 'growbike')).toThrow()
    expect(() => modelAccessRoleNames('bikebox', 'grow bike')).toThrow()
    expect(() => modelAccessRoleNames('bikebox', 'a/b')).toThrow()
    expect(() => modelAccessRoleNames('bikebox', '')).toThrow()
  })
})
