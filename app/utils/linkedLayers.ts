import type { Feature, FeatureCollection } from 'geojson'

// Layers a result links to instead of carrying them, as prepare-city does: a JSON object
// with `layers`, each layer with an `href` to its GeoJSON (an OGC API Features query).
// The map loads them only when switched on, so a summary of a whole city stays small.

export interface LinkedLayer {
  name: string
  href: string
  /** Number of features, if the result states it. */
  count?: number
}

// The most features one request asks for; the umep collections allow 20000.
export const MAX_FEATURES = 20000

export function linkedLayersOf(data: unknown): LinkedLayer[] {
  if (!data || typeof data !== 'object') return []
  const layers = (data as { layers?: unknown }).layers
  if (!layers || typeof layers !== 'object' || Array.isArray(layers)) return []
  const found: LinkedLayer[] = []
  for (const [name, layer] of Object.entries(layers as Record<string, unknown>)) {
    const l = layer as { href?: unknown, count?: unknown } | null
    if (typeof l?.href !== 'string' || !/^https?:\/\//.test(l.href)) continue
    found.push({ name, href: l.href, ...(typeof l.count === 'number' ? { count: l.count } : {}) })
  }
  return found
}

// The address to load: an items query gets a limit large enough for all features (up to
// MAX_FEATURES), since collections return only a first page otherwise.
export function loadUrl(layer: LinkedLayer): string {
  const url = new URL(layer.href)
  if (url.pathname.endsWith('/items') && !url.searchParams.has('limit')) {
    url.searchParams.set('limit', String(Math.min(layer.count ?? MAX_FEATURES, MAX_FEATURES)))
  }
  return url.toString()
}

// A single feature (such as the city boundary) as a collection, so the map takes both.
export function asCollection(data: unknown): FeatureCollection | null {
  if (!data || typeof data !== 'object') return null
  const d = data as { type?: unknown, features?: unknown }
  if (d.type === 'FeatureCollection' && Array.isArray(d.features)) return data as FeatureCollection
  if (d.type === 'Feature') return { type: 'FeatureCollection', features: [data as Feature] }
  return null
}
