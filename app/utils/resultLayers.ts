import type { FeatureCollection, Geometry } from 'geojson'
import type { ProcessOutput, ResultLayerSpec } from '~/types/ump'

// Aus dem deklarierten Output und dem, was wirklich ankommt, wird eine
// Layer-Beschreibung für die Karte.
//
// Die Deklaration allein reicht nicht. UMP führt den Typ an zwei verschiedenen
// Stellen (`format` und `contentMediaType`), und am 2026-09-22 deklariert ein
// Output, der wörtlich `GeoJSON` heißt, nur `application/json`. Wer sich auf die
// Deklaration verlässt, zeigt dieses Ergebnis nicht an, obwohl es Geodaten sind.
//
// Deshalb zwei Wege, in dieser Reihenfolge: sagt die Deklaration eindeutig
// Geodaten, gilt sie. Sagt sie nichts, sehen wir in die Antwort. Umgekehrt nie:
// was als GeoJSON deklariert ist, aber keines ist, bekommt keinen Layer.

/** Deklarierte Werte, die eindeutig für eine FeatureCollection stehen. */
const GEO_FORMATE = ['geojson-feature-collection', 'geojson']
const GEO_MEDIENTYPEN = ['application/geo+json', 'application/vnd.geo+json']

export function istGeoDeklariert(output: ProcessOutput): boolean {
  const format = output.format?.toLowerCase()
  const medientyp = output.mediaType?.toLowerCase()
  return (format !== undefined && GEO_FORMATE.includes(format))
    || (medientyp !== undefined && GEO_MEDIENTYPEN.includes(medientyp))
}

/** Sieht nach, ob die Antwort tatsächlich eine FeatureCollection ist. */
export function istFeatureCollection(daten: unknown): daten is FeatureCollection {
  if (typeof daten !== 'object' || daten === null) return false
  const k = daten as { type?: unknown, features?: unknown }
  return k.type === 'FeatureCollection' && Array.isArray(k.features)
}

/**
 * Welche Geometriearten kommen vor? Bestimmt das Styling: eine Linie wird
 * gestrichen, ein Punkt bekommt einen Kreis.
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
 * Die Layer, die ein Ergebnis hergibt. Leere Liste heißt: nichts daran lässt
 * sich auf einer Karte zeigen, und die Seite sagt das, statt eine leere Karte
 * zu zeigen.
 */
export function resultLayers(outputs: ProcessOutput[], daten: unknown): ResultLayerSpec[] {
  if (!istFeatureCollection(daten) || daten.features.length === 0) return []

  const geometry = geometrieArt(daten)
  const deklariert = outputs.find(istGeoDeklariert)
  if (deklariert) {
    return [{ name: deklariert.name, kind: 'geojson', geometry, quelle: 'deklariert' }]
  }

  // Nichts Passendes deklariert, aber es sind Geodaten. Der Name des ersten
  // Outputs ist dann die beste verfügbare Bezeichnung; gibt es keinen, nennen
  // wir es schlicht Ergebnis.
  return [{
    name: outputs[0]?.name ?? 'result',
    kind: 'geojson',
    geometry,
    quelle: 'erkannt',
  }]
}
