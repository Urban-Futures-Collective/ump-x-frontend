import { describe, expect, it } from 'vitest'
import type { RegistryModel } from '~/types/registry'
import { blockingFromDetail, blockingModels, groupByBaseUrl, modelsOfServer, normalizeBaseUrl, statusCounts } from './serverDeletion'

const model = (serverName: string, status: RegistryModel['status']) => ({ serverName, status }) as RegistryModel

describe('models of a server', () => {
  const models = [model('a', 'draft'), model('a', 'published'), model('a', 'published'), model('b', 'rejected')]
  it('picks the models by server name', () => {
    expect(modelsOfServer({ name: 'a' }, models)).toHaveLength(3)
  })
  it('names the ones that block deletion', () => {
    expect(blockingModels(models).map(m => m.status)).toEqual(['published', 'published'])
    expect(blockingModels(modelsOfServer({ name: 'b' }, models))).toEqual([])
  })
  it('counts statuses, most frequent first', () => {
    expect(statusCounts(modelsOfServer({ name: 'a' }, models))).toEqual([{ status: 'published', n: 2 }, { status: 'draft', n: 1 }])
  })
})

describe('normalizeBaseUrl', () => {
  it('ignores case of the host, trailing slashes and default ports', () => {
    expect(normalizeBaseUrl('https://Models.Example.org:443/api//')).toBe('https://models.example.org/api/')
    expect(normalizeBaseUrl('https://models.example.org/api')).toBe('https://models.example.org/api/')
    expect(normalizeBaseUrl('http://mock-ogc:5001')).toBe('http://mock-ogc:5001/')
  })
})

describe('groupByBaseUrl', () => {
  it('puts shared base URLs first and the rest in one group', () => {
    const groups = groupByBaseUrl([
      { name: 'z', baseUrl: 'https://x.org/' },
      { name: 'noise-2', baseUrl: 'https://models.example.org' },
      { name: 'noise', baseUrl: 'https://Models.example.org/' },
      { name: 'a', baseUrl: 'https://y.org/' },
    ])
    expect(groups).toEqual([
      { baseUrl: 'https://models.example.org/', servers: [{ name: 'noise', baseUrl: 'https://Models.example.org/' }, { name: 'noise-2', baseUrl: 'https://models.example.org' }] },
      { baseUrl: '', servers: [{ name: 'a', baseUrl: 'https://y.org/' }, { name: 'z', baseUrl: 'https://x.org/' }] },
    ])
  })
  it('is empty without servers', () => {
    expect(groupByBaseUrl([])).toEqual([])
  })
})

describe('blockingFromDetail', () => {
  it('reads the blocking models from the 409 detail', () => {
    expect(blockingFromDetail('A server can only be deleted while all its models are deactivated, draft, rejected; blocking: noise-2024 (submitted), noise-rail (verified)'))
      .toEqual([{ slug: 'noise-2024', status: 'submitted' }, { slug: 'noise-rail', status: 'verified' }])
  })
  it('is empty for other messages', () => {
    expect(blockingFromDetail('Conflict')).toEqual([])
  })
})
