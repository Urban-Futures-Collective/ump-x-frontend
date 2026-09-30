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
const GEO_FORMATE = ['geojson-feature-collection', 'geojson']
const GEO_MEDIENTYPEN = ['application/geo+json', 'application/vnd.geo+json']

export function istGeoDeklariert(output: ProcessOutput): boolean {
  const format = output.format?.toLowerCase()
  const medientyp = output.mediaType?.toLowerCase()
  return (format !== undefined && GEO_FORMATE.includes(format))
    || (medientyp !== undefined && GEO_MEDIENTYPEN.includes(medientyp))
}

export function istFeatureCollection(daten: unknown): daten is FeatureCollection {
  if (typeof daten !== 'object' || daten === null) return false
  const k = daten as { type?: unknown, features?: unknown }
  return k.type === 'FeatureCollection' && Array.isArray(k.features)
}

/**
 * Geometry kind of the collection, used for styling. Several kinds, or none
 * recognised, yield `mixed`.
 */
export function geometrieArt(fc: FeatureCollection): ResultLayerSpec['geometry'] {
  const arten = new Set<ResultLayerSpec['geometry']>()
  for (const f of fc.features) {
    const art = einordnen(f.geometry)
    if (art) arten.add(art)
  }
  if (arten.size === 0) return 'mixed'
  if (arten.size === 1) return [...arten][0]!
  return 'mixed'
}

function einordnen(geom: Geometry | null): ResultLayerSpec['geometry'] | null {
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
export function resultLayers(outputs: ProcessOutput[], daten: unknown): ResultLayerSpec[] {
  if (!istFeatureCollection(daten) || daten.features.length === 0) return []

  const geometry = geometrieArt(daten)
  const deklariert = outputs.find(istGeoDeklariert)
  if (deklariert) {
    return [{ name: deklariert.name, kind: 'geojson', geometry, quelle: 'deklariert' }]
  }

  // Geodata without a matching declaration: name it after the first output,
  // or fall back to `result`.
  return [{
    name: outputs[0]?.name ?? 'result',
    kind: 'geojson',
    geometry,
    quelle: 'erkannt',
  }]
}
