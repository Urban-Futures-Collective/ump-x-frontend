import { describe, expect, it } from 'vitest'
import { indicatorsOf, legendOf, localText } from './resultExtras'

const result = {
  'type': 'FeatureCollection',
  'features': [],
  'x-ump-indicators': [
    { id: 'density', title: { en: 'Intersection density', de: 'Kreuzungsdichte' }, value: 68.5, unit: { en: 'per km²', de: 'je km²' } },
    { id: 'share', title: 'Dead ends', value: 23, unit: '%', description: { en: 'Share of nodes', de: 'Anteil der Knoten' } },
    { id: 'broken', title: { de: 'ohne Wert' } },
    'not an object',
  ],
  'x-ump-legend': [
    { title: { en: 'quiet', de: 'ruhig' }, color: '#fde68a' },
    { title: 'bad colour', color: 'red' },
  ],
}

describe('result extras', () => {
  it('picks the requested language, then English, then any', () => {
    expect(localText({ en: 'A', de: 'B' }, 'de')).toBe('B')
    expect(localText({ en: 'A' }, 'de')).toBe('A')
    expect(localText({ fr: 'C' }, 'de')).toBe('C')
    expect(localText(42, 'de')).toBeUndefined()
  })

  it('reads indicators with formatted values and leaves out broken ones', () => {
    const list = indicatorsOf(result, 'de')
    expect(list.map(i => i.title)).toEqual(['Kreuzungsdichte', 'Dead ends'])
    expect(list[0]!.value).toBe('68,5 je km²')
    expect(list[1]!.description).toBe('Anteil der Knoten')
  })

  it('reads the legend and skips entries without a valid colour', () => {
    expect(legendOf(result, 'en')).toEqual([{ title: 'quiet', color: '#fde68a' }])
  })

  it('returns nothing for results without extras', () => {
    expect(indicatorsOf({ type: 'FeatureCollection', features: [] }, 'de')).toEqual([])
    expect(legendOf(null, 'de')).toEqual([])
  })
})
