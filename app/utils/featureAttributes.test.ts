import { describe, expect, it } from 'vitest'
import { featureAttributes } from './featureAttributes'

describe('featureAttributes', () => {
  it('leaves out geometry, colours and empty values', () => {
    expect(featureAttributes({
      geometry: {},
      'name': 'Main Street',
      'fill': '#ff0000',
      'fill-opacity': 0.5,
      'stroke': '#000',
      'marker-color': '#00f',
      'note': '',
      'missing': null,
      'heat_stress': 0.73456,
      'lit': true,
    })).toEqual([
      { key: 'name', value: 'Main Street' },
      { key: 'heat_stress', value: '0.735' },
      { key: 'lit', value: 'true' },
    ])
  })

  it('formats numbers in the page language and shows objects as JSON', () => {
    expect(featureAttributes({ length_m: 1234.5, tags: { a: 1 } }, 'de')).toEqual([
      { key: 'length_m', value: '1.234,5' },
      { key: 'tags', value: '{"a":1}' },
    ])
  })

  it('copes with no properties', () => {
    expect(featureAttributes(null)).toEqual([])
  })
})
