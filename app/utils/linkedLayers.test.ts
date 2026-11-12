import { describe, expect, it } from 'vitest'
import { asCollection, linkedLayersOf, loadUrl, MAX_FEATURES } from './linkedLayers'

// Shape of a prepare-city result (umep model server).
const manifest = {
  id: 'fichtenwalde',
  layers: {
    buildings: { count: 1200, href: 'https://umep.example.org/collections/buildings/items?city=fichtenwalde&f=json' },
    streets: { count: 415, href: 'https://umep.example.org/collections/streets/items?city=fichtenwalde&f=json' },
    boundary: { source: 'Nominatim', href: 'https://umep.example.org/collections/cities/items/fichtenwalde?f=json' },
    terrain: { path: 'terrain.tif' },
  },
}

describe('linkedLayersOf', () => {
  it('finds the layers with a link and keeps their counts', () => {
    expect(linkedLayersOf(manifest)).toEqual([
      { name: 'buildings', href: manifest.layers.buildings.href, count: 1200 },
      { name: 'streets', href: manifest.layers.streets.href, count: 415 },
      { name: 'boundary', href: manifest.layers.boundary.href },
    ])
  })

  it('ignores anything else', () => {
    expect(linkedLayersOf(null)).toEqual([])
    expect(linkedLayersOf('<html>')).toEqual([])
    expect(linkedLayersOf({ type: 'FeatureCollection', features: [] })).toEqual([])
    expect(linkedLayersOf({ layers: { a: { href: 'javascript:alert(1)' } } })).toEqual([])
  })
})

describe('loadUrl', () => {
  it('asks for all features of an items query', () => {
    expect(loadUrl({ name: 'streets', href: manifest.layers.streets.href, count: 415 })).toContain('limit=415')
    expect(loadUrl({ name: 'b', href: 'https://x.org/collections/b/items?f=json', count: 90000 })).toContain(`limit=${MAX_FEATURES}`)
    expect(loadUrl({ name: 'b', href: 'https://x.org/collections/b/items?f=json&limit=5' })).toContain('limit=5')
  })

  it('leaves a single feature alone', () => {
    expect(loadUrl({ name: 'boundary', href: manifest.layers.boundary.href })).not.toContain('limit')
  })
})

describe('asCollection', () => {
  it('wraps a single feature', () => {
    const f = { type: 'Feature', geometry: null, properties: {} }
    expect(asCollection(f)).toEqual({ type: 'FeatureCollection', features: [f] })
    expect(asCollection({ type: 'FeatureCollection', features: [] })).toEqual({ type: 'FeatureCollection', features: [] })
    expect(asCollection('<html>')).toBeNull()
  })
})
