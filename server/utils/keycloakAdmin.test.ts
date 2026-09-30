import { describe, expect, it } from 'vitest'
import { keycloakAdminUrls, realmUrlAus } from './keycloakAdmin'

describe('keycloakAdminUrls', () => {
  it('heutige Keycloak-Adresse ohne /auth', () => {
    expect(keycloakAdminUrls('https://auth.urbanfuturescollective.org/realms/UrbanModelPlatform')).toEqual({
      token: 'https://auth.urbanfuturescollective.org/realms/UrbanModelPlatform/protocol/openid-connect/token',
      admin: 'https://auth.urbanfuturescollective.org/admin/realms/UrbanModelPlatform',
    })
  })

  it('ältere Adresse mit /auth und Schrägstrich am Ende', () => {
    expect(keycloakAdminUrls('http://localhost:8282/auth/realms/UrbanModelPlatform/')).toEqual({
      token: 'http://localhost:8282/auth/realms/UrbanModelPlatform/protocol/openid-connect/token',
      admin: 'http://localhost:8282/auth/admin/realms/UrbanModelPlatform',
    })
  })

  it('lehnt eine Adresse ohne Realm ab', () => {
    expect(() => keycloakAdminUrls('https://auth.urbanfuturescollective.org')).toThrow()
  })
})

describe('realmUrlAus', () => {
  it('leitet die Realm-Adresse aus der tokenUrl ab, auch wenn baseUrl leer ist', () => {
    expect(realmUrlAus({
      baseUrl: '',
      tokenUrl: 'https://auth.urbanfuturescollective.org/realms/UrbanModelPlatform/protocol/openid-connect/token',
    })).toBe('https://auth.urbanfuturescollective.org/realms/UrbanModelPlatform')
  })

  it('nimmt baseUrl, wenn die tokenUrl nur der relative Preset-Wert ist', () => {
    expect(realmUrlAus({
      baseUrl: 'http://localhost:8282/auth/realms/UrbanModelPlatform',
      tokenUrl: 'protocol/openid-connect/token',
    })).toBe('http://localhost:8282/auth/realms/UrbanModelPlatform')
  })

  it('gibt undefined, wenn beides fehlt', () => {
    expect(realmUrlAus({ baseUrl: '', tokenUrl: 'protocol/openid-connect/token' })).toBeUndefined()
    expect(realmUrlAus(undefined)).toBeUndefined()
  })
})
