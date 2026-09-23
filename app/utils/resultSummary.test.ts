import type { FeatureCollection } from 'geojson'
import { describe, expect, it } from 'vitest'
import { fasseErgebnisZusammen } from './resultSummary'

// Diese Funktion ist der Grund, warum Ergebnisdaten nicht zum KI-Anbieter gehen:
// aus 841 kB GeoJSON werden rund 200 Byte. Bricht sie, wandern entweder falsche
// Zahlen in die Antwort oder es fliegt eine Ausnahme mitten im Werkzeugaufruf.
function sammlung(features: unknown[]): FeatureCollection {
  return { type: 'FeatureCollection', features } as FeatureCollection
}

const linie = {
  type: 'Feature',
  geometry: { type: 'LineString', coordinates: [[8.12, 51.79], [8.19, 51.85]] },
  properties: { rank: 1, length: 120 },
}

describe('fasseErgebnisZusammen', () => {
  it('zählt die Objekte', () => {
    expect(fasseErgebnisZusammen(sammlung([linie, linie, linie])).anzahl).toBe(3)
  })

  it('sammelt die Geometrietypen ohne Wiederholung', () => {
    const punkt = { type: 'Feature', geometry: { type: 'Point', coordinates: [8.1, 51.8] }, properties: {} }
    expect(fasseErgebnisZusammen(sammlung([linie, punkt, linie])).geometrien).toEqual(['LineString', 'Point'])
  })

  it('spannt die Ausdehnung über verschachtelte Koordinaten', () => {
    const flaeche = {
      type: 'Feature',
      geometry: { type: 'MultiPolygon', coordinates: [[[[8.2, 51.7], [8.25, 51.72], [8.2, 51.7]]]] },
      properties: {},
    }
    expect(fasseErgebnisZusammen(sammlung([linie, flaeche])).bbox).toEqual([8.12, 51.7, 8.25, 51.85])
  })

  it('versteht eine GeometryCollection', () => {
    const gemischt = {
      type: 'Feature',
      geometry: {
        type: 'GeometryCollection',
        geometries: [
          { type: 'Point', coordinates: [8.0, 51.6] },
          { type: 'Point', coordinates: [8.3, 51.9] },
        ],
      },
      properties: {},
    }
    expect(fasseErgebnisZusammen(sammlung([gemischt])).bbox).toEqual([8, 51.6, 8.3, 51.9])
  })

  it('rundet die Ausdehnung auf fünf Nachkommastellen', () => {
    const genau = {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [8.1234567, 51.7654321] },
      properties: {},
    }
    expect(fasseErgebnisZusammen(sammlung([genau])).bbox).toEqual([8.12346, 51.76543, 8.12346, 51.76543])
  })

  it('überspringt Objekte ohne Geometrie, statt zu stolpern', () => {
    const ohne = { type: 'Feature', geometry: null, properties: { name: 'ohne' } }
    const z = fasseErgebnisZusammen(sammlung([linie, ohne]))
    expect(z.anzahl).toBe(2)
    expect(z.geometrien).toEqual(['LineString'])
    expect(z.bbox).toEqual([8.12, 51.79, 8.19, 51.85])
  })

  it('liefert für ein leeres Ergebnis keine Ausdehnung statt einer erfundenen', () => {
    const z = fasseErgebnisZusammen(sammlung([]))
    expect(z).toEqual({ anzahl: 0, geometrien: [], bbox: undefined, eigenschaften: [] })
  })

  it('sammelt die Eigenschaftsnamen', () => {
    expect(fasseErgebnisZusammen(sammlung([linie])).eigenschaften).toEqual(['rank', 'length'])
  })

  it('deckelt die Eigenschaftsnamen bei zwanzig', () => {
    const viele = {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [8, 51] },
      properties: Object.fromEntries(Array.from({ length: 30 }, (_, i) => [`feld_${i}`, i])),
    }
    expect(fasseErgebnisZusammen(sammlung([viele])).eigenschaften).toHaveLength(20)
  })

  // Die Ausdehnung muss alle Objekte sehen, die Stichprobe gilt nur fuer Typen
  // und Eigenschaften. Sonst beschreibt die bbox die ersten 200 statt das Ergebnis.
  it('nimmt für die Ausdehnung auch Objekte jenseits der Stichprobe', () => {
    const viele = Array.from({ length: 250 }, () => linie)
    const weitDraussen = {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [9.5, 52.5] },
      properties: {},
    }
    const z = fasseErgebnisZusammen(sammlung([...viele, weitDraussen]))
    expect(z.anzahl).toBe(251)
    expect(z.bbox?.[2]).toBe(9.5)
    expect(z.bbox?.[3]).toBe(52.5)
  })
})
