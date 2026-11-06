import { describe, expect, it } from 'vitest'
import { cardPatchBody, credentialsBody, discoveredFromApi, ifMatch, ioFromDescription, langList, langMap, modelFromApi, serverFromApi, serverPatchBody } from './registryApi'

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
    expect(m.ownerName).toBe('')
    expect(m.anonymousAccess).toBe(false)
  })

  it('maps the provider name and anonymous access', () => {
    const m = modelFromApi({ ...apiModel, owner_display_name: 'Ada Lovelace', anonymous_access: true })
    expect(m.ownerName).toBe('Ada Lovelace')
    expect(m.anonymousAccess).toBe(true)
  })

  it('maps the card details a reviewer checks', () => {
    const m = modelFromApi({
      ...apiModel,
      contributors: [{ name: 'A', role: 'author' }, { role: 'funder' }],
      requirements: { cpu_cores: 4, memory_gb: null },
      test_cases: [{ name: 'Hamburg', input_url: 'https://i', expected_output_url: 'https://o' }, { name: 'incomplete' }],
      review: { verification_job_id: 'job-1' },
    })
    expect(m.contributors).toEqual([{ name: 'A', role: 'author' }])
    expect(m.requirements).toEqual({ cpuCores: 4, memoryGb: undefined, runtimeSeconds: undefined })
    expect(m.testCases).toMatchObject([{ name: 'Hamburg', inputUrl: 'https://i', expectedOutputUrl: 'https://o' }])
    expect(m.verificationJobId).toBe('job-1')
  })

  it('maps an unknown status to draft rather than failing', () => {
    expect(modelFromApi({ ...apiModel, status: 'archived' }).status).toBe('draft')
  })

  it('builds the server PATCH body from what changed only', () => {
    expect(serverPatchBody({})).toEqual({})
    expect(serverPatchBody({ baseUrl: 'https://y', isActive: false })).toEqual({ base_url: 'https://y', is_active: false })
    expect(serverPatchBody({ auth: null })).toEqual({ authentication: null })
    expect(serverPatchBody({ auth: { type: 'BearerToken', secret: 't' }, ttwSeconds: 600 }))
      .toEqual({ authentication: { type: 'BearerToken', token: 't' }, ttw_job_done_seconds: 600 })
  })

  it('maps servers and discovered processes', () => {
    expect(serverFromApi({ id: 's1', name: 'osmnx', base_url: 'https://x', owner_sub: null, auth_type: 'BasicAuth', credentials_set: true }))
      .toEqual({ ttwSeconds: undefined, isActive: true, id: 's1', name: 'osmnx', baseUrl: 'https://x', authType: 'BasicAuth', hasCredentials: true, ownerSub: '' })
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

  it('maps the full model card', () => {
    const m = modelFromApi({
      ...apiModel,
      keywords: { en: ['cycling', 'osm'], de: ['Radverkehr'], fr: ['vélo'] },
      code_ref: 'v1.0.3',
      applications: [{ title: { en: 'Hamburg 2030' }, location: 'Hamburg', year: 2025 }, { location: 'untitled' }],
      requirements: { gpu: true, software: ['Python 3.11'] },
      io_notes: { city: { en: 'OSM name' } },
    })
    expect(m.keywordsByLang).toEqual({ en: ['cycling', 'osm'], de: ['Radverkehr'] })
    expect(m.codeRef).toBe('v1.0.3')
    expect(m.applications).toMatchObject([{ title: { en: 'Hamburg 2030' }, location: 'Hamburg', year: 2025 }])
    expect(m.requirements).toMatchObject({ gpu: true, software: ['Python 3.11'] })
    expect(m.ioNotes).toEqual({ city: { en: 'OSM name' } })
  })

  it('builds the full card patch and drops incomplete entries', () => {
    expect(cardPatchBody({
      keywordsByLang: { en: ['a'], de: [] },
      codeRef: '',
      contributors: [{ name: ' Ada ', role: 'author', orcid: '' }, { name: ' ', role: 'funder' }],
      literature: [{ citation: 'X (2022)', year: 2022 }],
      applications: [{ title: { en: 'Hamburg' }, description: { en: ' ' } }, { title: {} }],
      requirements: { cpuCores: 4, gpu: false, software: [] },
      testCases: [{ name: 'T', inputUrl: 'https://i', expectedOutputUrl: 'https://o', inputSha256: 'AB' }, { name: 'x', inputUrl: '', expectedOutputUrl: '' }],
      ioNotes: { city: { en: 'OSM' }, steps: { en: '' } },
    })).toEqual({
      keywords: { en: ['a'] },
      code_ref: null,
      contributors: [{ name: 'Ada', role: 'author' }],
      literature: [{ citation: 'X (2022)', year: 2022 }],
      applications: [{ title: { en: 'Hamburg' } }],
      requirements: { cpu_cores: 4, gpu: false },
      test_cases: [{ name: 'T', input_url: 'https://i', expected_output_url: 'https://o', input_sha256: 'ab' }],
      io_notes: { city: { en: 'OSM' } },
    })
  })

  it('reads keywords per language', () => {
    expect(langList({ en: ['a', 3, ''], de: 'x' })).toEqual({ en: ['a'] })
    expect(langList(null)).toEqual({})
  })

  it('lists inputs and outputs of a process description', () => {
    expect(ioFromDescription({
      inputs: { steps: { schema: { type: 'integer', minimum: 1, maximum: 40 } }, ranking: { schema: { enum: ['betweenness', 'random'] } } },
      outputs: { network: { schema: { type: 'object' } } },
    })).toEqual([
      { id: 'steps', kind: 'input', type: 'integer, 1–40' },
      { id: 'ranking', kind: 'input', type: 'enum: betweenness, random' },
      { id: 'network', kind: 'output', type: 'object' },
    ])
    expect(ioFromDescription(undefined)).toEqual([])
  })
})

describe('ifMatch', () => {
  it('drops the weak prefix a compressing proxy adds', () => {
    expect(ifMatch('W/"2026-11-02T13:20:22.252028+00:00"')).toBe('"2026-11-02T13:20:22.252028+00:00"')
  })

  it('keeps a strong ETag as it is', () => {
    expect(ifMatch('"2026-11-02T13:20:22.252028+00:00"')).toBe('"2026-11-02T13:20:22.252028+00:00"')
  })

  it('falls back to * without an ETag', () => {
    expect(ifMatch(null)).toBe('*')
  })
})
