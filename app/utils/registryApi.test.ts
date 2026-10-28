import { describe, expect, it } from 'vitest'
import { cardPatchBody, credentialsBody, discoveredFromApi, langMap, modelFromApi, serverFromApi } from './registryApi'

const apiModel = {
  id: 'a1',
  slug: 'growbike',
  provider: 'bikebox-modelserver',
  remote_process_id: 'growbike',
  owner_sub: 'u1',
  default_lang: 'en',
  full_name: { en: 'Grow bike', de: 'Radnetz', fr: 'Vélo' },
  short_description: null,
  keywords: { en: ['cycling'], de: ['Rad'] },
  status: 'in_review',
  interface_state: 'unreachable',
  updated_at: '2026-10-20T10:00:00Z',
  review: { status_note: 'Looks fine', status_changed_at: '2026-10-21T10:00:00Z' },
}

describe('registry API mapping', () => {
  it('keeps only the languages the frontend knows', () => {
    expect(langMap({ en: 'A', de: '', fr: 'B' })).toEqual({ en: 'A' })
    expect(langMap(null)).toEqual({})
  })

  it('maps a model card', () => {
    const m = modelFromApi(apiModel)
    expect(m.serverName).toBe('bikebox-modelserver')
    expect(m.fullName).toEqual({ en: 'Grow bike', de: 'Radnetz' })
    expect(m.shortDescription).toEqual({})
    expect(m.keywords).toEqual(['cycling'])
    expect(m.status).toBe('in_review')
    expect(m.statusNote).toBe('Looks fine')
    expect(m.statusChangedAt).toBe('2026-10-21T10:00:00Z')
    expect(m.interfaceState).toBe('unchecked')
  })

  it('maps an unknown status to draft rather than failing', () => {
    expect(modelFromApi({ ...apiModel, status: 'archived' }).status).toBe('draft')
  })

  it('maps servers and discovered processes', () => {
    expect(serverFromApi({ id: 's1', name: 'osmnx', base_url: 'https://x', owner_sub: null, auth_type: 'BasicAuth', credentials_set: true }))
      .toEqual({ id: 's1', name: 'osmnx', baseUrl: 'https://x', authType: 'BasicAuth', hasCredentials: true, ownerSub: '' })
    expect(discoveredFromApi({ id: 'p', title: null, version: '1.0', model_id: 'm1' }))
      .toEqual({ id: 'p', title: undefined, description: undefined, version: '1.0', modelId: 'm1' })
  })

  it('builds the credentials of a new server', () => {
    expect(credentialsBody({ type: 'NoAuth' })).toBeNull()
    expect(credentialsBody({ type: 'BasicAuth', user: 'ump', secret: 's' })).toEqual({ type: 'BasicAuth', user: 'ump', password: 's' })
    expect(credentialsBody({ type: 'ApiKey', keyName: 'X-API-Key', secret: 'k' })).toEqual({ type: 'ApiKey', key_name: 'X-API-Key', key_value: 'k' })
    expect(credentialsBody({ type: 'BearerToken', secret: 't' })).toEqual({ type: 'BearerToken', token: 't' })
  })

  it('builds a card patch without empty texts', () => {
    expect(cardPatchBody({ fullName: { en: 'A', de: ' ' }, purpose: { en: '' }, license: '' }))
      .toEqual({ full_name: { en: 'A' }, purpose: null, license: null })
  })
})
