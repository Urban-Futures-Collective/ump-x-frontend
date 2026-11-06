import type { GeometryType } from './geometryInput'
import { GEOMETRY_TYPES } from './geometryInput'

// Inputs that take a GeoJSON FeatureCollection (buildings, trees, land cover): recognised
// by `format: "geojson-feature-collection"` or by a schema whose `features` items carry
// a geometry. The schema of one feature says which geometries may be drawn and which
// properties each feature needs; the feature editor is built from it.

type Schema = Record<string, unknown>

const isObject = (v: unknown): v is Schema => !!v && typeof v === 'object' && !Array.isArray(v)

// Every schema node reachable through allOf/oneOf/anyOf, the node itself first.
function variants(s: unknown): Schema[] {
  if (!isObject(s)) return []
  const out: Schema[] = [s]
  for (const key of ['allOf', 'oneOf', 'anyOf']) {
    if (Array.isArray(s[key])) for (const sub of s[key] as unknown[]) out.push(...variants(sub))
  }
  return out
}

function propertyOf(s: unknown, name: string): Schema | undefined {
  for (const v of variants(s)) {
    const p = isObject(v.properties) ? v.properties[name] : undefined
    if (isObject(p)) return p
  }
  return undefined
}

function itemSchema(schema: Schema | undefined): Schema | undefined {
  const features = propertyOf(schema, 'features')
  return isObject(features?.items) ? features.items : undefined
}

export function isFeatureCollectionInput(schema: Schema | undefined): boolean {
  if (schema?.format === 'geojson-feature-collection') return true
  return !!propertyOf(itemSchema(schema), 'geometry')
}

export interface FeatureProperty {
  name: string
  type: 'number' | 'integer' | 'string' | 'boolean'
  required: boolean
  description?: string
  minimum?: number
  maximum?: number
  exclusiveMinimum?: number
  exclusiveMaximum?: number
  enum?: unknown[]
  default?: unknown
}

export interface FeatureSchema {
  geometryTypes: GeometryType[]
  properties: FeatureProperty[]
}

const num = (v: unknown) => typeof v === 'number' ? v : undefined

export function featureSchemaOf(schema: Schema | undefined): FeatureSchema {
  const item = itemSchema(schema)
  const geometry = propertyOf(item, 'geometry')
  const found = new Set<string>()
  for (const v of variants(geometry)) {
    const typeProp = propertyOf(v, 'type')
    for (const t of (typeProp?.enum as unknown[] | undefined) ?? []) if (typeof t === 'string') found.add(t)
  }
  const geometryTypes = found.size ? GEOMETRY_TYPES.filter(t => found.has(t)) : [...GEOMETRY_TYPES]

  const props = propertyOf(item, 'properties')
  const required = new Set<string>()
  const properties: FeatureProperty[] = []
  for (const v of variants(props)) {
    for (const r of (v.required as unknown[] | undefined) ?? []) if (typeof r === 'string') required.add(r)
    if (!isObject(v.properties)) continue
    for (const [name, p] of Object.entries(v.properties)) {
      if (!isObject(p) || properties.some(x => x.name === name)) continue
      const type = p.type === 'integer' || p.type === 'number' || p.type === 'boolean' ? p.type : 'string'
      properties.push({
        name,
        type,
        required: false,
        description: typeof p.description === 'string' ? p.description : undefined,
        minimum: num(p.minimum),
        maximum: num(p.maximum),
        exclusiveMinimum: num(p.exclusiveMinimum),
        exclusiveMaximum: num(p.exclusiveMaximum),
        enum: Array.isArray(p.enum) ? p.enum : undefined,
        default: p.default,
      })
    }
  }
  for (const p of properties) p.required = required.has(p.name)
  // Required properties the schema names but does not describe still need a field.
  for (const name of required) {
    if (!properties.some(p => p.name === name)) properties.push({ name, type: 'string', required: true })
  }
  return { geometryTypes, properties }
}

// What can be drawn: one tool per kind of geometry the schema allows.
export type DrawTool = 'Polygon' | 'LineString' | 'Point'

export function drawTools(types: GeometryType[]): DrawTool[] {
  const tools: DrawTool[] = []
  if (types.some(t => t.endsWith('Polygon'))) tools.push('Polygon')
  if (types.some(t => t.endsWith('LineString'))) tools.push('LineString')
  if (types.some(t => t.endsWith('Point'))) tools.push('Point')
  return tools
}

// A drawn single geometry goes out as the Multi* type when only that is allowed.
export function fitGeometryType(geometry: { type: string, coordinates: unknown }, types: GeometryType[]): { type: string, coordinates: unknown } {
  if ((types as string[]).includes(geometry.type) || geometry.type.startsWith('Multi')) return geometry
  const multi = `Multi${geometry.type}`
  return (types as string[]).includes(multi) ? { type: multi, coordinates: [geometry.coordinates] } : geometry
}

export type PropertyProblem = 'required' | 'number' | 'min' | 'max' | 'choice'

// One property value of a feature against its schema.
export function propertyProblem(p: FeatureProperty, value: unknown): PropertyProblem | null {
  if (value === undefined || value === null || value === '') return p.required ? 'required' : null
  if (p.enum && !p.enum.includes(value)) return 'choice'
  if (p.type === 'number' || p.type === 'integer') {
    if (typeof value !== 'number' || !Number.isFinite(value) || (p.type === 'integer' && !Number.isInteger(value))) return 'number'
    if ((p.minimum !== undefined && value < p.minimum) || (p.exclusiveMinimum !== undefined && value <= p.exclusiveMinimum)) return 'min'
    if ((p.maximum !== undefined && value > p.maximum) || (p.exclusiveMaximum !== undefined && value >= p.exclusiveMaximum)) return 'max'
  }
  return null
}

// Text from the form field back to the property's type; empty removes the property.
export function propertyValue(p: FeatureProperty, text: string): unknown {
  const s = text.trim()
  if (s === '') return undefined
  if (p.type === 'number' || p.type === 'integer') return Number(s.replace(',', '.'))
  if (p.type === 'boolean') return s === 'true'
  return s
}

// Number of features with at least one problem.
export function featuresWithProblems(features: { properties?: Record<string, unknown> | null }[], schema: FeatureSchema): number {
  return features.filter(f => schema.properties.some(p => propertyProblem(p, f.properties?.[p.name]))).length
}

export function parseFeatureCollection(text: string): { type: 'FeatureCollection', features: Schema[] } | null {
  if (!text.trim()) return { type: 'FeatureCollection', features: [] }
  try {
    const v = JSON.parse(text)
    if (isObject(v) && v.type === 'FeatureCollection' && Array.isArray(v.features)) return v as { type: 'FeatureCollection', features: Schema[] }
    if (isObject(v) && v.type === 'Feature') return { type: 'FeatureCollection', features: [v] }
  }
  catch {
    // not JSON
  }
  return null
}
