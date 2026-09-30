import type { FeatureCollection, Position } from 'geojson'

// A compact summary of a job result that can be shared with the AI provider.
//
// Results can be megabytes of GeoJSON. They go to the map, never to an AI
// provider: that would transfer data at the user's cost and risk for an answer
// that needs only a few numbers. This is where those numbers are computed.

export interface ResultSummary {
  count: number
  geometries: string[]
  /** [west, south, east, north] in WGS84, rounded to five decimals. */
  bbox?: [number, number, number, number]
  properties: string[]
}

// Number of features sampled for property names and geometry types. Both are
// usually clear after the first few, and a huge result must not freeze the UI.
const SAMPLE_SIZE = 200
const MAX_PROPERTIES = 20

function extendBounds(coords: unknown, box: number[]): void {
  if (!Array.isArray(coords)) return
  // A position is [x, y, ...]: numbers in the first two slots.
  if (typeof coords[0] === 'number' && typeof coords[1] === 'number') {
    const [x, y] = coords as Position
    if (!Number.isFinite(x) || !Number.isFinite(y)) return
    box[0] = Math.min(box[0]!, x)
    box[1] = Math.min(box[1]!, y)
    box[2] = Math.max(box[2]!, x)
    box[3] = Math.max(box[3]!, y)
    return
  }
  for (const item of coords) extendBounds(item, box)
}

export function summarizeResult(fc: FeatureCollection): ResultSummary {
  const features = fc?.features ?? []
  const box = [Infinity, Infinity, -Infinity, -Infinity]
  const geometries = new Set<string>()
  const properties = new Set<string>()

  features.forEach((f, i) => {
    const g = f?.geometry
    if (g) {
      if (i < SAMPLE_SIZE) geometries.add(g.type)
      // The extent uses all features, otherwise it would describe only the sample.
      if (g.type === 'GeometryCollection') {
        for (const part of g.geometries) extendBounds((part as { coordinates?: unknown }).coordinates, box)
      }
      else {
        extendBounds(g.coordinates, box)
      }
    }
    if (i < SAMPLE_SIZE && f?.properties) {
      for (const k of Object.keys(f.properties)) properties.add(k)
    }
  })

  // A bbox from UMP would be preferable, but it is optional and usually missing,
  // so we compute it ourselves.
  const round = (n: number) => Math.round(n * 1e5) / 1e5
  const bbox = Number.isFinite(box[0])
    ? ([round(box[0]!), round(box[1]!), round(box[2]!), round(box[3]!)] as [number, number, number, number])
    : undefined

  return {
    count: features.length,
    geometries: [...geometries],
    bbox,
    properties: [...properties].slice(0, MAX_PROPERTIES),
  }
}
