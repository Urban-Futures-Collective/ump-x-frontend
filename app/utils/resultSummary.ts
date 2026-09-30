import type { FeatureCollection, Position } from 'geojson'

// A compact summary of a job result that can be shared with the AI provider.
//
// Results can be megabytes of GeoJSON. They go to the map, never to an AI
// provider: that would transfer data at the user's cost and risk for an answer
// that needs only a few numbers. This is where those numbers are computed.

export interface ErgebnisZusammenfassung {
  anzahl: number
  geometrien: string[]
  /** [west, south, east, north] in WGS84, rounded to five decimals. */
  bbox?: [number, number, number, number]
  eigenschaften: string[]
}

// Number of features sampled for property names and geometry types. Both are
// usually clear after the first few, and a huge result must not freeze the UI.
const STICHPROBE = 200
const MAX_EIGENSCHAFTEN = 20

function grenzen(coords: unknown, box: number[]): void {
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
  for (const teil of coords) grenzen(teil, box)
}

export function fasseErgebnisZusammen(fc: FeatureCollection): ErgebnisZusammenfassung {
  const features = fc?.features ?? []
  const box = [Infinity, Infinity, -Infinity, -Infinity]
  const geometrien = new Set<string>()
  const eigenschaften = new Set<string>()

  features.forEach((f, i) => {
    const g = f?.geometry
    if (g) {
      if (i < STICHPROBE) geometrien.add(g.type)
      // The extent uses all features, otherwise it would describe only the sample.
      if (g.type === 'GeometryCollection') {
        for (const teil of g.geometries) grenzen((teil as { coordinates?: unknown }).coordinates, box)
      }
      else {
        grenzen(g.coordinates, box)
      }
    }
    if (i < STICHPROBE && f?.properties) {
      for (const k of Object.keys(f.properties)) eigenschaften.add(k)
    }
  })

  // A bbox from UMP would be preferable, but it is optional and usually missing,
  // so we compute it ourselves.
  const runde = (n: number) => Math.round(n * 1e5) / 1e5
  const bbox = Number.isFinite(box[0])
    ? ([runde(box[0]!), runde(box[1]!), runde(box[2]!), runde(box[3]!)] as [number, number, number, number])
    : undefined

  return {
    anzahl: features.length,
    geometrien: [...geometrien],
    bbox,
    eigenschaften: [...eigenschaften].slice(0, MAX_EIGENSCHAFTEN),
  }
}
