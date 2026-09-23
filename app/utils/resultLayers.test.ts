import type { FeatureCollection } from 'geojson'
import { describe, expect, it } from 'vitest'
import type { ProcessOutput } from '~/types/ump'
import { geometrieArt, istGeoDeklariert, resultLayers } from './resultLayers'

// Die Funktion kennt keine Modelle, sie sieht Deklarationen und Antworten. Die
// Fälle hier bilden ab, was UMP am 2026-09-22 wirklich liefert, ohne an einem
// bestimmten Modell zu hängen.
const deklariertGeo: ProcessOutput = {
  name: 'ergebnis',
  title: 'Ergebnis',
  format: 'geojson-feature-collection',
}
const deklariertUnbestimmt: ProcessOutput = {
  name: 'ergebnis',
  title: 'Ergebnis',
  mediaType: 'application/json',
}

function fc(...geometrien: FeatureCollection['features'][number]['geometry'][]): FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: geometrien.map(geometry => ({ type: 'Feature', properties: {}, geometry })),
  }
}

const linie = { type: 'LineString', coordinates: [[0, 0], [1, 1]] } as const
const punkt = { type: 'Point', coordinates: [0, 0] } as const
const flaeche = { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] } as const

describe('istGeoDeklariert', () => {
  it('erkennt das Format', () => {
    expect(istGeoDeklariert(deklariertGeo)).toBe(true)
  })

  it('erkennt den Medientyp', () => {
    expect(istGeoDeklariert({ name: 'a', title: 'A', mediaType: 'application/geo+json' })).toBe(true)
  })

  it('nimmt application/json nicht als Geodaten', () => {
    expect(istGeoDeklariert(deklariertUnbestimmt)).toBe(false)
  })

  it('urteilt nicht nach dem Namen', () => {
    expect(istGeoDeklariert({ name: 'GeoJSON', title: 'GeoJSON' })).toBe(false)
  })
})

describe('geometrieArt', () => {
  it('erkennt reine Linien', () => {
    expect(geometrieArt(fc(linie, linie))).toBe('line')
  })

  it('erkennt reine Punkte', () => {
    expect(geometrieArt(fc(punkt))).toBe('point')
  })

  it('erkennt reine Flächen', () => {
    expect(geometrieArt(fc(flaeche))).toBe('polygon')
  })

  it('nennt Gemischtes gemischt', () => {
    expect(geometrieArt(fc(linie, punkt))).toBe('mixed')
  })
})

describe('resultLayers', () => {
  it('folgt der Deklaration, wenn sie Geodaten sagt', () => {
    expect(resultLayers([deklariertGeo], fc(linie))).toEqual([
      { name: 'ergebnis', kind: 'geojson', geometry: 'line', quelle: 'deklariert' },
    ])
  })

  it('erkennt Geodaten auch ohne Deklaration', () => {
    expect(resultLayers([deklariertUnbestimmt], fc(punkt))).toEqual([
      { name: 'ergebnis', kind: 'geojson', geometry: 'point', quelle: 'erkannt' },
    ])
  })

  it('gibt nichts zurück, wenn die Antwort keine FeatureCollection ist', () => {
    expect(resultLayers([deklariertGeo], { ergebnis: 42 })).toEqual([])
  })

  it('gibt nichts zurück, wenn die FeatureCollection leer ist', () => {
    expect(resultLayers([deklariertGeo], fc())).toEqual([])
  })

  it('kommt ohne deklarierte Outputs aus', () => {
    expect(resultLayers([], fc(linie))).toEqual([
      { name: 'result', kind: 'geojson', geometry: 'line', quelle: 'erkannt' },
    ])
  })
})
