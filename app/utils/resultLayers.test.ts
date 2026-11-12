import type { FeatureCollection, Geometry } from 'geojson'
import { describe, expect, it } from 'vitest'
import type { ProcessOutput } from '~/types/ump'
import { geometryKind, isGeoDeclared, resultLayers } from './resultLayers'

// The function knows no models, only declarations and responses. The fixtures
// mirror the declaration shapes UMP actually returns.
const declaredGeo: ProcessOutput = {
  name: 'network',
  title: 'Network',
  format: 'geojson-feature-collection',
}
const declaredUnspecified: ProcessOutput = {
  name: 'network',
  title: 'Network',
  mediaType: 'application/json',
}

function fc(...geometries: FeatureCollection['features'][number]['geometry'][]): FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: geometries.map(geometry => ({ type: 'Feature', properties: {}, geometry })),
  }
}

const line: Geometry = { type: 'LineString', coordinates: [[0, 0], [1, 1]] }
const point: Geometry = { type: 'Point', coordinates: [0, 0] }
const polygon: Geometry = { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] }

describe('isGeoDeclared', () => {
  it('recognises the format', () => {
    expect(isGeoDeclared(declaredGeo)).toBe(true)
  })

  it('recognises the media type', () => {
    expect(isGeoDeclared({ name: 'a', title: 'A', mediaType: 'application/geo+json' })).toBe(true)
  })

  it('does not take application/json as geodata', () => {
    expect(isGeoDeclared(declaredUnspecified)).toBe(false)
  })

  it('does not judge by the name', () => {
    expect(isGeoDeclared({ name: 'GeoJSON', title: 'GeoJSON' })).toBe(false)
  })
})

describe('geometryKind', () => {
  it('recognises pure lines', () => {
    expect(geometryKind(fc(line, line))).toBe('line')
  })

  it('recognises pure points', () => {
    expect(geometryKind(fc(point))).toBe('point')
  })

  it('recognises pure polygons', () => {
    expect(geometryKind(fc(polygon))).toBe('polygon')
  })

  it('calls a mix mixed', () => {
    expect(geometryKind(fc(line, point))).toBe('mixed')
  })
})

describe('resultLayers', () => {
  it('follows the declaration when it says geodata', () => {
    expect(resultLayers([declaredGeo], fc(line))).toEqual([
      { name: 'network', kind: 'geojson', geometry: 'line', source: 'declared' },
    ])
  })

  it('detects geodata without a declaration', () => {
    expect(resultLayers([declaredUnspecified], fc(point))).toEqual([
      { name: 'network', kind: 'geojson', geometry: 'point', source: 'detected' },
    ])
  })

  it('returns nothing when the response is not a FeatureCollection', () => {
    expect(resultLayers([declaredGeo], { result: 42 })).toEqual([])
  })

  it('returns nothing when the FeatureCollection is empty', () => {
    expect(resultLayers([declaredGeo], fc())).toEqual([])
  })

  it('works without declared outputs', () => {
    expect(resultLayers([], fc(line))).toEqual([
      { name: 'result', kind: 'geojson', geometry: 'line', source: 'detected' },
    ])
  })
})
