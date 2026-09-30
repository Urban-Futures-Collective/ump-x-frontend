import { describe, expect, it } from 'vitest'
import { keycloakAdminUrls } from './keycloakAdmin'

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
