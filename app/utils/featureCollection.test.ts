import { describe, expect, it } from 'vitest'
import { drawTools, featureSchemaOf, featuresWithProblems, fitGeometryType, isFeatureCollectionInput, parseFeatureCollection, propertyProblem, propertyValue } from './featureCollection'

// As the UMEP server describes "trees" (rules below allOf).
const trees = {
  type: 'object',
  format: 'geojson-feature-collection',
  allOf: [{
    type: 'object',
    properties: {
      type: { type: 'string', const: 'FeatureCollection' },
      features: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            geometry: { type: 'object', properties: { type: { type: 'string', enum: ['Point', 'Polygon', 'MultiPolygon'] } } },
            properties: {
              type: 'object',
              required: ['height'],
              properties: {
                height: { type: 'number', exclusiveMinimum: 0, maximum: 150, description: 'Height in metres' },
                crown_diameter: { type: 'number', minimum: 0 },
              },
            },
          },
        },
      },
    },
  }],
}

describe('feature schema', () => {
  it('recognises a feature collection input', () => {
    expect(isFeatureCollectionInput(trees)).toBe(true)
    expect(isFeatureCollectionInput({ ...trees, format: undefined })).toBe(true)
    expect(isFeatureCollectionInput({ type: 'object', format: 'geojson-geometry' })).toBe(false)
    expect(isFeatureCollectionInput(undefined)).toBe(false)
  })
  it('reads geometry types and properties', () => {
    const s = featureSchemaOf(trees)
    expect(s.geometryTypes).toEqual(['Point', 'Polygon', 'MultiPolygon'])
    expect(s.properties).toEqual([
      { name: 'height', type: 'number', required: true, description: 'Height in metres', minimum: undefined, maximum: 150, exclusiveMinimum: 0, exclusiveMaximum: undefined, enum: undefined, default: undefined },
      { name: 'crown_diameter', type: 'number', required: false, description: undefined, minimum: 0, maximum: undefined, exclusiveMinimum: undefined, exclusiveMaximum: undefined, enum: undefined, default: undefined },
    ])
    expect(drawTools(s.geometryTypes)).toEqual(['Polygon', 'Point'])
  })
  it('allows every geometry and no properties without a schema', () => {
    const s = featureSchemaOf({ type: 'object', format: 'geojson-feature-collection' })
    expect(drawTools(s.geometryTypes)).toEqual(['Polygon', 'LineString', 'Point'])
    expect(s.properties).toEqual([])
  })
})

describe('feature values', () => {
  const [height, crown] = featureSchemaOf(trees).properties
  it('checks a property against its schema', () => {
    expect(propertyProblem(height!, undefined)).toBe('required')
    expect(propertyProblem(height!, 0)).toBe('min')
    expect(propertyProblem(height!, 151)).toBe('max')
    expect(propertyProblem(height!, Number.NaN)).toBe('number')
    expect(propertyProblem(height!, 12)).toBeNull()
    expect(propertyProblem(crown!, undefined)).toBeNull()
  })
  it('converts form text to the property type', () => {
    expect(propertyValue(height!, '12,5')).toBe(12.5)
    expect(propertyValue(height!, ' ')).toBeUndefined()
  })
  it('counts features with problems', () => {
    expect(featuresWithProblems([{ properties: { height: 3 } }, { properties: {} }, { properties: null }], featureSchemaOf(trees))).toBe(2)
  })
  it('wraps a drawn polygon when only MultiPolygon is allowed', () => {
    expect(fitGeometryType({ type: 'Polygon', coordinates: [[1]] }, ['MultiPolygon'])).toEqual({ type: 'MultiPolygon', coordinates: [[[1]]] })
    expect(fitGeometryType({ type: 'Polygon', coordinates: [[1]] }, ['Polygon', 'MultiPolygon'])).toEqual({ type: 'Polygon', coordinates: [[1]] })
  })
  it('parses collections and single features', () => {
    expect(parseFeatureCollection('')).toEqual({ type: 'FeatureCollection', features: [] })
    expect(parseFeatureCollection('{"type":"Feature","geometry":null,"properties":{}}')?.features).toHaveLength(1)
    expect(parseFeatureCollection('nope')).toBeNull()
  })
})

describe('form check of a feature collection input', () => {
  it('reports features with missing values and invalid JSON', async () => {
    const { inputProblem } = await import('./processInputs')
    const field = { name: 'trees', type: 'object', schema: trees as Record<string, unknown>, required: true }
    const ok = JSON.stringify({ type: 'FeatureCollection', features: [{ type: 'Feature', geometry: null, properties: { height: 5 } }] })
    const missing = JSON.stringify({ type: 'FeatureCollection', features: [{ type: 'Feature', geometry: null, properties: {} }] })
    expect(inputProblem(field, ok)).toBeNull()
    expect(inputProblem(field, missing)).toEqual({ key: 'features', limit: 1 })
    expect(inputProblem(field, '{')).toEqual({ key: 'json' })
  })
})
