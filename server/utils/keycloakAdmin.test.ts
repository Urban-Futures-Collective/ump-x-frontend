import { describe, expect, it } from 'vitest'
import { keycloakAdminUrls, realmUrlFrom } from './keycloakAdmin'

describe('keycloakAdminUrls', () => {
  it('current Keycloak URL without /auth', () => {
    expect(keycloakAdminUrls('https://auth.urbanfuturescollective.org/realms/UrbanModelPlatform')).toEqual({
      token: 'https://auth.urbanfuturescollective.org/realms/UrbanModelPlatform/protocol/openid-connect/token',
      admin: 'https://auth.urbanfuturescollective.org/admin/realms/UrbanModelPlatform',
    })
  })

  it('older URL with /auth and a trailing slash', () => {
    expect(keycloakAdminUrls('http://localhost:8282/auth/realms/UrbanModelPlatform/')).toEqual({
      token: 'http://localhost:8282/auth/realms/UrbanModelPlatform/protocol/openid-connect/token',
      admin: 'http://localhost:8282/auth/admin/realms/UrbanModelPlatform',
    })
  })

  it('rejects a URL without a realm', () => {
    expect(() => keycloakAdminUrls('https://auth.urbanfuturescollective.org')).toThrow()
  })
})

describe('realmUrlFrom', () => {
  it('derives the realm URL from tokenUrl even when baseUrl is empty', () => {
    expect(realmUrlFrom({
      baseUrl: '',
      tokenUrl: 'https://auth.urbanfuturescollective.org/realms/UrbanModelPlatform/protocol/openid-connect/token',
    })).toBe('https://auth.urbanfuturescollective.org/realms/UrbanModelPlatform')
  })

  it('uses baseUrl when tokenUrl is only the relative preset value', () => {
    expect(realmUrlFrom({
      baseUrl: 'http://localhost:8282/auth/realms/UrbanModelPlatform',
      tokenUrl: 'protocol/openid-connect/token',
    })).toBe('http://localhost:8282/auth/realms/UrbanModelPlatform')
  })

  it('returns undefined when both are missing', () => {
    expect(realmUrlFrom({ baseUrl: '', tokenUrl: 'protocol/openid-connect/token' })).toBeUndefined()
    expect(realmUrlFrom(undefined)).toBeUndefined()
  })
})
