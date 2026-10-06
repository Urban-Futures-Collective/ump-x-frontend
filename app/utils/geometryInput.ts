// Inputs that take a geometry, recognised by the OGC API Processes convention
// `format: "geojson-geometry"` rather than by field name, so any model that follows the
// standard gets a map instead of a text field.

export const GEOMETRY_TYPES = ['Point', 'MultiPoint', 'LineString', 'MultiLineString', 'Polygon', 'MultiPolygon'] as const
export type GeometryType = typeof GEOMETRY_TYPES[number]

function isGeometryType(v: unknown): v is GeometryType {
  return typeof v === 'string' && (GEOMETRY_TYPES as readonly string[]).includes(v)
}

export function isGeometryInput(schema: Record<string, unknown> | undefined): boolean {
  return schema?.format === 'geojson-geometry'
}

// The geometry types an input accepts: the enum on `properties.type`, looked for in the
// schema itself and in allOf/oneOf/anyOf. Without such an enum every type is allowed.
export function allowedGeometryTypes(schema: Record<string, unknown> | undefined): GeometryType[] {
  const found = new Set<GeometryType>()
  const visit = (s: unknown) => {
    if (!s || typeof s !== 'object') return
    const node = s as Record<string, unknown>
    const typeProp = (node.properties as Record<string, { enum?: unknown[] }> | undefined)?.type
    for (const v of typeProp?.enum ?? []) if (isGeometryType(v)) found.add(v)
    for (const key of ['allOf', 'oneOf', 'anyOf']) {
      if (Array.isArray(node[key])) (node[key] as unknown[]).forEach(visit)
    }
  }
  visit(schema)
  return found.size ? GEOMETRY_TYPES.filter(t => found.has(t)) : [...GEOMETRY_TYPES]
}

// What the user draws on the map. Polygons win over lines and points: an input that
// accepts an area is about an area.
export type DrawKind = 'Polygon' | 'LineString' | 'Point'

export function drawKind(types: GeometryType[]): DrawKind {
  if (types.some(t => t.endsWith('Polygon'))) return 'Polygon'
  if (types.some(t => t.endsWith('LineString'))) return 'LineString'
  return 'Point'
}

// Whether several drawn shapes may be sent, as the Multi* type.
export function allowsMany(types: GeometryType[], kind: DrawKind): boolean {
  return types.includes(`Multi${kind}` as GeometryType)
}

// The GeoJSON geometry to send for the drawn shapes (coordinates in WGS 84). One shape
// goes out as the single type if that is allowed, otherwise as the Multi* type.
export function toGeometry(kind: DrawKind, types: GeometryType[], parts: unknown[]): Record<string, unknown> | null {
  if (!parts.length) return null
  const multi = `Multi${kind}` as GeometryType
  if (parts.length === 1 && types.includes(kind)) return { type: kind, coordinates: parts[0] }
  return types.includes(multi) ? { type: multi, coordinates: parts } : { type: kind, coordinates: parts[0] }
}

// The single shapes inside a geometry, the reverse of toGeometry, so a value from a
// link or an earlier run shows on the map again.
export function partsOf(geometry: unknown, kind: DrawKind): unknown[] {
  if (!geometry || typeof geometry !== 'object') return []
  const g = geometry as { type?: string, coordinates?: unknown }
  if (g.type === kind) return [g.coordinates]
  if (g.type === `Multi${kind}` && Array.isArray(g.coordinates)) return g.coordinates
  return []
}
