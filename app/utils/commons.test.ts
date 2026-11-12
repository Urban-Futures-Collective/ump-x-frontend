import { describe, expect, it } from 'vitest'
import type { RegistryModel } from '~/types/registry'
import { cardLangs, cardsByProcess, filterOptions, matchesFilter, pickLang, sortCommons, topicTone, TOPIC_TONES } from './commons'
import type { CommonsEntry } from './commons'

function card(over: Partial<RegistryModel> = {}): RegistryModel {
  return {
    id: 'm1',
    serverName: 'bikebox-modelserver',
    remoteProcessId: 'growbike',
    ownerSub: 'u1',
    ownerName: '',
    defaultLang: 'en',
    fullName: { en: 'growbike' },
    shortDescription: {},
    purpose: {},
    limitationsRisks: {},
    keywords: ['Mobility', 'Cycling'],
    versionLabel: '',
    repositoryUrl: '',
    license: 'MIT',
    status: 'published',
    statusChangedAt: '',
    createdAt: '',
    interfaceState: 'in_sync',
    inputs: [],
    contributors: [],
    literature: [],
    requirements: {},
    testCases: [],
    history: [],
    ...over,
  }
}

const entry = (title: string, c?: RegistryModel): CommonsEntry => ({ id: title, title, description: '', card: c })
const none = { topics: [], langs: [], licences: [] }

describe('commons', () => {
  it('falls back to the default language', () => {
    expect(pickLang({ en: 'Hello' }, 'de', 'en')).toBe('Hello')
    expect(pickLang({ en: 'Hello', de: 'Hallo' }, 'de', 'en')).toBe('Hallo')
  })

  it('lists the card languages, default first', () => {
    expect(cardLangs(card({ defaultLang: 'de', fullName: { de: 'x', en: 'y' } }))).toEqual(['de', 'en'])
    expect(cardLangs(card())).toEqual(['en'])
  })

  it('gives a topic always the same brand colour', () => {
    expect(topicTone('Mobility')).toBe(topicTone('mobility'))
    expect(TOPIC_TONES).toContain(topicTone('Health'))
  })

  it('keys cards by process id', () => {
    expect([...cardsByProcess([card()]).keys()]).toEqual(['bikebox-modelserver:growbike'])
  })

  it('offers only values that occur', () => {
    const opts = filterOptions([entry('a', card()), entry('b', card({ keywords: ['Health'], license: 'AGPL-3.0' })), entry('c')])
    expect(opts.topics).toEqual(['Cycling', 'Health', 'Mobility'])
    expect(opts.licences).toEqual(['AGPL-3.0', 'MIT'])
    expect(opts.langs).toEqual(['en'])
  })

  it('filters by topic, language and licence', () => {
    const a = entry('a', card())
    expect(matchesFilter(a, none)).toBe(true)
    expect(matchesFilter(a, { ...none, topics: ['Cycling'] })).toBe(true)
    expect(matchesFilter(a, { ...none, topics: ['Health'] })).toBe(false)
    expect(matchesFilter(a, { ...none, langs: ['de'] })).toBe(false)
    expect(matchesFilter(a, { ...none, licences: ['MIT'] })).toBe(true)
  })

  it('drops models without a card once a filter is set', () => {
    expect(matchesFilter(entry('x'), none)).toBe(true)
    expect(matchesFilter(entry('x'), { ...none, topics: ['Mobility'] })).toBe(false)
  })

  it('sorts by publication date, undated last, then by name', () => {
    const list = [
      entry('b'),
      entry('old', card({ publishedAt: '2026-09-02T10:00:00Z' })),
      entry('new', card({ publishedAt: '2026-10-24T10:00:00Z' })),
      entry('a'),
    ]
    expect(sortCommons(list, 'published').map(e => e.title)).toEqual(['new', 'old', 'a', 'b'])
    expect(sortCommons(list, 'name').map(e => e.title)).toEqual(['a', 'b', 'new', 'old'])
  })
})
