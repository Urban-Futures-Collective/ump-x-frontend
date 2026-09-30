import type { FeatureCollection } from 'geojson'
import { describe, expect, it } from 'vitest'
import { summarizeResult } from './resultSummary'

// This function keeps result data away from the AI provider by reducing large
// GeoJSON to a few hundred bytes. If it breaks, wrong numbers reach the answer
// or an exception is thrown mid tool call.
function collection(features: unknown[]): FeatureCollection {
  return { type: 'FeatureCollection', features } as FeatureCollection
}

const line = {
  type: 'Feature',
  geometry: { type: 'LineString', coordinates: [[8.12, 51.79], [8.19, 51.85]] },
  properties: { rank: 1, length: 120 },
}

describe('summarizeResult', () => {
  it('counts the features', () => {
    expect(summarizeResult(collection([line, line, line])).count).toBe(3)
  })

  it('collects the geometry types without duplicates', () => {
    const point = { type: 'Feature', geometry: { type: 'Point', coordinates: [8.1, 51.8] }, properties: {} }
    expect(summarizeResult(collection([line, point, line])).geometries).toEqual(['LineString', 'Point'])
  })

  it('spans the extent over nested coordinates', () => {
    const area = {
      type: 'Feature',
      geometry: { type: 'MultiPolygon', coordinates: [[[[8.2, 51.7], [8.25, 51.72], [8.2, 51.7]]]] },
      properties: {},
    }
    expect(summarizeResult(collection([line, area])).bbox).toEqual([8.12, 51.7, 8.25, 51.85])
  })

  it('understands a GeometryCollection', () => {
    const mixed = {
      type: 'Feature',
      geometry: {
        type: 'GeometryCollection',
        geometries: [
          { type: 'Point', coordinates: [8.0, 51.6] },
          { type: 'Point', coordinates: [8.3, 51.9] },
        ],
      },
      properties: {},
    }
    expect(summarizeResult(collection([mixed])).bbox).toEqual([8, 51.6, 8.3, 51.9])
  })

  it('rounds the extent to five decimals', () => {
    const precise = {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [8.1234567, 51.7654321] },
      properties: {},
    }
    expect(summarizeResult(collection([precise])).bbox).toEqual([8.12346, 51.76543, 8.12346, 51.76543])
  })

  it('skips features without geometry instead of failing', () => {
    const withoutGeometry = { type: 'Feature', geometry: null, properties: { name: 'ohne' } }
    const z = summarizeResult(collection([line, withoutGeometry]))
    expect(z.count).toBe(2)
    expect(z.geometries).toEqual(['LineString'])
    expect(z.bbox).toEqual([8.12, 51.79, 8.19, 51.85])
  })

  it('returns no extent for an empty result rather than a made-up one', () => {
    const z = summarizeResult(collection([]))
    expect(z).toEqual({ count: 0, geometries: [], bbox: undefined, properties: [] })
  })

  it('collects the property names', () => {
    expect(summarizeResult(collection([line])).properties).toEqual(['rank', 'length'])
  })

  it('caps the property names at twenty', () => {
    const many = {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [8, 51] },
      properties: Object.fromEntries(Array.from({ length: 30 }, (_, i) => [`feld_${i}`, i])),
    }
    expect(summarizeResult(collection([many])).properties).toHaveLength(20)
  })

  // The extent must cover all features; the sample only applies to types and
  // property names.
  it('includes features beyond the sample in the extent', () => {
    const many = Array.from({ length: 250 }, () => line)
    const farOut = {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [9.5, 52.5] },
      properties: {},
    }
    const z = summarizeResult(collection([...many, farOut]))
    expect(z.count).toBe(251)
    expect(z.bbox?.[2]).toBe(9.5)
    expect(z.bbox?.[3]).toBe(52.5)
  })
})
