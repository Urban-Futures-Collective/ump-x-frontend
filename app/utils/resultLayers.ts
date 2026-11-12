import type { FeatureCollection, Geometry } from 'geojson'
import type { ProcessOutput, ResultLayerSpec } from '~/types/ump'

// Derives map layer specs from the declared outputs plus the actual response.
//
// The declaration alone is not enough: UMP puts the type in either `format` or
// `contentMediaType`, and some geodata outputs only declare `application/json`.
//
// So: if the declaration clearly says geodata, use it; otherwise inspect the
// response. Never the other way round: an output declared as GeoJSON whose
// response is not a FeatureCollection gets no layer.

/** Declared values that unambiguously mean a FeatureCollection. */
const GEO_FORMATS = ['geojson-feature-collection', 'geojson']
const GEO_MEDIA_TYPES = ['application/geo+json', 'application/vnd.geo+json']

export function isGeoDeclared(output: ProcessOutput): boolean {
  const format = output.format?.toLowerCase()
  const mediaType = output.mediaType?.toLowerCase()
  return (format !== undefined && GEO_FORMATS.includes(format))
    || (mediaType !== undefined && GEO_MEDIA_TYPES.includes(mediaType))
}

export function isFeatureCollection(data: unknown): data is FeatureCollection {
  if (typeof data !== 'object' || data === null) return false
  const obj = data as { type?: unknown, features?: unknown }
  return obj.type === 'FeatureCollection' && Array.isArray(obj.features)
}

/**
 * Geometry kind of the collection, used for styling. Several kinds, or none
 * recognised, yield `mixed`.
 */
export function geometryKind(fc: FeatureCollection): ResultLayerSpec['geometry'] {
  const kinds = new Set<ResultLayerSpec['geometry']>()
  for (const f of fc.features) {
    const kind = classify(f.geometry)
    if (kind) kinds.add(kind)
  }
  if (kinds.size === 0) return 'mixed'
  if (kinds.size === 1) return [...kinds][0]!
  return 'mixed'
}

function classify(geom: Geometry | null): ResultLayerSpec['geometry'] | null {
  if (!geom) return null
  switch (geom.type) {
    case 'LineString':
    case 'MultiLineString':
      return 'line'
    case 'Point':
    case 'MultiPoint':
      return 'point'
    case 'Polygon':
    case 'MultiPolygon':
      return 'polygon'
    case 'GeometryCollection':
      return 'mixed'
    default:
      return null
  }
}

/**
 * Layers a result provides. An empty list means nothing is mappable, and the
 * page shows a notice instead of an empty map.
 */
export function resultLayers(outputs: ProcessOutput[], data: unknown): ResultLayerSpec[] {
  if (!isFeatureCollection(data) || data.features.length === 0) return []

  const geometry = geometryKind(data)
  const declared = outputs.find(isGeoDeclared)
  if (declared) {
    return [{ name: declared.name, kind: 'geojson', geometry, source: 'declared' }]
  }

  // Geodata without a matching declaration: name it after the first output,
  // or fall back to `result`.
  return [{
    name: outputs[0]?.name ?? 'result',
    kind: 'geojson',
    geometry,
    source: 'detected',
  }]
}
