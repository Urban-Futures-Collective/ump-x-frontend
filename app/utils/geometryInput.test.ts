import { describe, expect, it } from 'vitest'
import { allowedGeometryTypes, allowsMany, drawKind, isGeometryInput, partsOf, toGeometry } from './geometryInput'

// The area input of prepare-city, as the umep server describes it.
const areaSchema = {
  type: 'object',
  format: 'geojson-geometry',
  allOf: [{ type: 'object', required: ['type', 'coordinates'], properties: { type: { type: 'string', enum: ['Polygon', 'MultiPolygon'] }, coordinates: { type: 'array' } } }],
}

describe('geometry inputs', () => {
  it('recognises the OGC geometry format', () => {
    expect(isGeometryInput(areaSchema)).toBe(true)
    expect(isGeometryInput({ type: 'object' })).toBe(false)
    expect(isGeometryInput(undefined)).toBe(false)
  })

  it('reads the allowed types from allOf', () => {
    expect(allowedGeometryTypes(areaSchema)).toEqual(['Polygon', 'MultiPolygon'])
  })

  it('allows every type without an enum', () => {
    expect(allowedGeometryTypes({ format: 'geojson-geometry' })).toHaveLength(6)
  })

  it('draws polygons when areas are allowed, points otherwise', () => {
    expect(drawKind(['Polygon', 'MultiPolygon'])).toBe('Polygon')
    expect(drawKind(['MultiPoint'])).toBe('Point')
    expect(allowsMany(['Polygon', 'MultiPolygon'], 'Polygon')).toBe(true)
    expect(allowsMany(['Polygon'], 'Polygon')).toBe(false)
  })

  it('sends one shape as the single type and several as the Multi type', () => {
    const ring = [[[13, 52], [13.1, 52], [13.1, 52.1], [13, 52]]]
    expect(toGeometry('Polygon', ['Polygon', 'MultiPolygon'], [ring])).toEqual({ type: 'Polygon', coordinates: ring })
    expect(toGeometry('Polygon', ['Polygon', 'MultiPolygon'], [ring, ring])).toEqual({ type: 'MultiPolygon', coordinates: [ring, ring] })
    expect(toGeometry('Point', ['MultiPoint'], [[13, 52]])).toEqual({ type: 'MultiPoint', coordinates: [[13, 52]] })
    expect(toGeometry('Polygon', ['Polygon'], [])).toBeNull()
  })

  it('splits a geometry back into shapes', () => {
    expect(partsOf({ type: 'MultiPoint', coordinates: [[1, 2], [3, 4]] }, 'Point')).toEqual([[1, 2], [3, 4]])
    expect(partsOf({ type: 'Point', coordinates: [1, 2] }, 'Point')).toEqual([[1, 2]])
    expect(partsOf({ type: 'LineString', coordinates: [] }, 'Point')).toEqual([])
  })
})
