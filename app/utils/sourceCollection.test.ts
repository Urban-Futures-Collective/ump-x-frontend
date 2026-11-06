import { describe, expect, it } from 'vitest'
import { bboxOf, DEFAULT_BUFFER_M, growBbox, sourceCollectionOf, sourceUrl } from './sourceCollection'

const href = 'https://umep.example.org/collections/buildings/items?f=json&city={city}&bbox={bbox}&limit=20000'
const area = JSON.stringify({ type: 'Polygon', coordinates: [[[10, 53], [10.01, 53], [10.01, 53.01], [10, 53.01], [10, 53]]] })

describe('sourceCollectionOf', () => {
  it('reads the source-collection entry', () => {
    expect(sourceCollectionOf([{ role: 'other', href: 'x' }, { role: 'source-collection', title: 'Status quo', href, 'x-ump-buffer-m': 50 }]))
      .toEqual({ href, title: 'Status quo', bufferM: 50 })
  })
  it('falls back to the default buffer when UMP dropped it', () => {
    expect(sourceCollectionOf([{ role: 'source-collection', title: 'Status quo', href }])?.bufferM).toBe(DEFAULT_BUFFER_M)
  })
  it('ignores missing or other metadata', () => {
    expect(sourceCollectionOf(undefined)).toBeUndefined()
    expect(sourceCollectionOf({ role: 'source-collection', href })).toBeUndefined()
    expect(sourceCollectionOf([{ role: 'source-collection' }])).toBeUndefined()
  })
})

describe('bboxOf', () => {
  it('covers geometries, features and collections', () => {
    expect(bboxOf(JSON.parse(area))).toEqual([10, 53, 10.01, 53.01])
    expect(bboxOf({ type: 'FeatureCollection', features: [
      { type: 'Feature', geometry: { type: 'Point', coordinates: [1, 2] } },
      { type: 'Feature', geometry: { type: 'Point', coordinates: [3, -1] } },
    ] })).toEqual([1, -1, 3, 2])
  })
  it('is undefined without coordinates', () => {
    expect(bboxOf({ type: 'Polygon', coordinates: [] })).toBeUndefined()
  })
})

describe('growBbox', () => {
  it('grows by about the given metres', () => {
    const [minx, miny, maxx, maxy] = growBbox([10, 53, 10.01, 53.01], 100)
    expect((53 - miny) * 111_320).toBeCloseTo(100, 0)
    expect((maxy - 53.01) * 111_320).toBeCloseTo(100, 0)
    expect(10 - minx).toBeGreaterThan(53 - miny) // degrees of longitude are shorter
    expect(maxx).toBeGreaterThan(10.01)
  })
})

describe('sourceUrl', () => {
  const source = { href, bufferM: 0 }
  it('fills city and bbox', () => {
    expect(sourceUrl(source, { city: 'eissendorf', area })).toEqual({
      url: 'https://umep.example.org/collections/buildings/items?f=json&city=eissendorf&bbox=10,53,10.01,53.01&limit=20000',
    })
  })
  it('names the inputs that are still empty', () => {
    expect(sourceUrl(source, { city: '', area: '' })).toEqual({ missing: ['city', 'area'] })
    expect(sourceUrl(source, { city: 'x', area: 'not json' })).toEqual({ missing: ['area'] })
  })
})
