// Prefill an input from the model server's own data (`metadata` with role
// `source-collection`, see the umep-modelserver docs/process-descriptions.md).
// The href is a collection URL with placeholders: `{bbox}` is the bounding box of
// the `area` input grown by `x-ump-buffer-m` metres, any other `{name}` is the
// current value of that input. The response is a FeatureCollection that already
// fits the input.

export interface SourceCollection {
  href: string
  title?: string
  bufferM: number
}

// UMP currently drops extra fields on metadata, so `x-ump-buffer-m` may be missing.
// 100 m is what the UMEP server sends.
export const DEFAULT_BUFFER_M = 100

export function sourceCollectionOf(metadata: unknown): SourceCollection | undefined {
  if (!Array.isArray(metadata)) return undefined
  const entry = metadata.find(m => m && typeof m === 'object' && (m as Record<string, unknown>).role === 'source-collection') as Record<string, unknown> | undefined
  if (!entry || typeof entry.href !== 'string') return undefined
  const buffer = Number(entry['x-ump-buffer-m'])
  return {
    href: entry.href,
    title: typeof entry.title === 'string' ? entry.title : undefined,
    bufferM: Number.isFinite(buffer) && buffer >= 0 ? buffer : DEFAULT_BUFFER_M,
  }
}

// [minx, miny, maxx, maxy] of every coordinate in a GeoJSON geometry, Feature or
// FeatureCollection; undefined if there is none.
export function bboxOf(geojson: unknown): [number, number, number, number] | undefined {
  const box = [Infinity, Infinity, -Infinity, -Infinity] as [number, number, number, number]
  const visit = (c: unknown): void => {
    if (!Array.isArray(c)) return
    if (typeof c[0] === 'number' && typeof c[1] === 'number') {
      box[0] = Math.min(box[0], c[0])
      box[1] = Math.min(box[1], c[1])
      box[2] = Math.max(box[2], c[0])
      box[3] = Math.max(box[3], c[1])
      return
    }
    c.forEach(visit)
  }
  const walk = (g: unknown): void => {
    if (!g || typeof g !== 'object') return
    const o = g as Record<string, unknown>
    if (o.type === 'FeatureCollection' && Array.isArray(o.features)) o.features.forEach(walk)
    else if (o.type === 'Feature') walk(o.geometry)
    else if (o.type === 'GeometryCollection' && Array.isArray(o.geometries)) o.geometries.forEach(walk)
    else visit(o.coordinates)
  }
  walk(geojson)
  return Number.isFinite(box[0]) ? box : undefined
}

// Grow a WGS 84 box by metres on every side.
export function growBbox([minx, miny, maxx, maxy]: [number, number, number, number], metres: number): [number, number, number, number] {
  const dLat = metres / 111_320
  const midLat = ((miny + maxy) / 2) * Math.PI / 180
  const dLon = metres / (111_320 * Math.max(Math.cos(midLat), 0.01))
  const r = (n: number) => Math.round(n * 1e6) / 1e6
  return [r(minx - dLon), r(miny - dLat), r(maxx + dLon), r(maxy + dLat)]
}

// The URL to load, or the names of the inputs that still need a value.
export function sourceUrl(source: SourceCollection, values: Record<string, string>): { url: string } | { missing: string[] } {
  const missing: string[] = []
  const url = source.href.replace(/\{([\w-]+)\}/g, (_, name: string) => {
    if (name === 'bbox') {
      let box: ReturnType<typeof bboxOf>
      try {
        box = values.area ? bboxOf(JSON.parse(values.area)) : undefined
      }
      catch {
        box = undefined
      }
      if (!box) {
        missing.push('area')
        return ''
      }
      return growBbox(box, source.bufferM).join(',')
    }
    const v = values[name]
    if (!v) {
      missing.push(name)
      return ''
    }
    return encodeURIComponent(v)
  })
  return missing.length ? { missing } : { url }
}
