import { describe, expect, it } from 'vitest'
import { matchesSearch } from './search'

describe('matchesSearch', () => {
  it('matches everything for an empty query', () => {
    expect(matchesSearch('  ', 'growbike')).toBe(true)
  })

  it('ignores case and accents', () => {
    expect(matchesSearch('HITZE', 'Hitzebelastung')).toBe(true)
    expect(matchesSearch('strasse', 'Straße')).toBe(false)
    expect(matchesSearch('creme', 'Crème')).toBe(true)
  })

  it('needs every word, in any field', () => {
    expect(matchesSearch('bike gaps', 'fixbike', 'detect gaps in bicycle networks')).toBe(true)
    expect(matchesSearch('bike heat', 'fixbike', 'detect gaps')).toBe(false)
  })

  it('skips missing fields', () => {
    expect(matchesSearch('seir', null, undefined, 'SEIR model')).toBe(true)
  })
})
