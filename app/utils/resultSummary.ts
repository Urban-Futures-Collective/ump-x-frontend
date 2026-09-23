import type { FeatureCollection, Position } from 'geojson'

// Was von einem Ergebnis erzählt werden darf, ohne es zu verschicken.
//
// Ein growbike-Ergebnis sind Megabyte GeoJSON. Die gehen an die Karte, aber
// niemals an einen KI-Anbieter: das wäre Datenübertragung auf Kosten und Risiko
// des Nutzers, für eine Antwort, die aus vier Zahlen besteht. Diese Datei ist
// die Stelle, an der aus dem Ergebnis die vier Zahlen werden.

export interface ErgebnisZusammenfassung {
  anzahl: number
  geometrien: string[]
  /** [West, Sued, Ost, Nord] in WGS84, auf fuenf Nachkommastellen. */
  bbox?: [number, number, number, number]
  eigenschaften: string[]
}

// Wie viele Objekte fuer Eigenschaften und Geometrietypen angesehen werden.
// Beides ist in der Praxis nach den ersten Objekten bekannt, und ein Lauf mit
// hunderttausend Linien soll die Oberflaeche nicht anhalten.
const STICHPROBE = 200
const MAX_EIGENSCHAFTEN = 20

function grenzen(coords: unknown, box: number[]): void {
  if (!Array.isArray(coords)) return
  // Eine Position ist [x, y, ...]: Zahlen an den ersten beiden Stellen.
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
      // Die Ausdehnung braucht alle Objekte, sonst beschreibt sie die Stichprobe
      // statt das Ergebnis.
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

  // Die von UMP gelieferte bbox waere die ehrlichere Quelle, ist aber optional
  // und fehlt bei den Modellen, die heute rechnen. Deshalb selbst gerechnet.
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
