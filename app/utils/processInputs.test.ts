import { describe, expect, it } from 'vitest'
import { bereinigeEingaben, type EingabeFeld } from './processInputs'

// Diese Regel benutzen Formular und Chat gemeinsam. Zwei Fassungen davon hieße:
// der Chat baut einen Aufruf, der kippt, obwohl derselbe aus dem Formular
// durchgeht. Deshalb steht sie hier unter Test und nicht nur unter Kommentar.
//
// Die Felder sind growbike nachgebildet, weil dort jede Besonderheit vorkommt,
// die uns bisher Ärger gemacht hat: ein Pflichtfeld ohne Vorgabe, ein Zahlenfeld
// mit dem String "auto" als Vorgabe, und ein Zahlenfeld mit einer echten Zahl.
const felder: EingabeFeld[] = [
  { name: 'cityname', type: 'string' },
  { name: 'crs_projected', type: 'string', default: '3857' },
  { name: 'seed_point_grid_spacing', type: 'integer', default: 'auto' },
  { name: 'existing_network_spacing', type: 'integer' },
  { name: 'mit_bahn', type: 'boolean', default: 'false' },
]

describe('bereinigeEingaben', () => {
  it('lässt leere Eingaben weg, damit die Vorgabe des Backends greift', () => {
    expect(bereinigeEingaben(felder, { cityname: '', crs_projected: '   ' })).toEqual({})
  })

  it('lässt fehlende Schlüssel weg', () => {
    expect(bereinigeEingaben(felder, {})).toEqual({})
  })

  it('schickt eine unveränderte Vorgabe nicht mit', () => {
    expect(bereinigeEingaben(felder, { crs_projected: '3857' })).toEqual({})
  })

  it('schickt eine geänderte Vorgabe mit', () => {
    expect(bereinigeEingaben(felder, { crs_projected: '3035' })).toEqual({ crs_projected: '3035' })
  })

  // Der Fall, an dem growbike früher abgestürzt ist: Number("auto") ist NaN.
  it('schickt die Vorgabe "auto" eines Zahlenfelds nicht als Zahl mit', () => {
    expect(bereinigeEingaben(felder, { seed_point_grid_spacing: 'auto' })).toEqual({})
  })

  it('lässt einen unbrauchbaren Wert in einem Zahlenfeld ganz weg', () => {
    expect(bereinigeEingaben(felder, { seed_point_grid_spacing: 'ungefähr 1000' })).toEqual({})
  })

  it('wandelt Zahlenfelder in Zahlen, nicht in Zeichenketten', () => {
    const rumpf = bereinigeEingaben(felder, { existing_network_spacing: '200' })
    expect(rumpf).toEqual({ existing_network_spacing: 200 })
    expect(typeof rumpf.existing_network_spacing).toBe('number')
  })

  it('schneidet Leerraum ab, bevor es urteilt', () => {
    expect(bereinigeEingaben(felder, { cityname: '  Oelde  ' })).toEqual({ cityname: 'Oelde' })
    expect(bereinigeEingaben(felder, { crs_projected: ' 3857 ' })).toEqual({})
  })

  it('versteht die üblichen Wahrheitswerte', () => {
    expect(bereinigeEingaben(felder, { mit_bahn: 'true' })).toEqual({ mit_bahn: true })
    expect(bereinigeEingaben(felder, { mit_bahn: '1' })).toEqual({ mit_bahn: true })
    expect(bereinigeEingaben(felder, { mit_bahn: 'nein' })).toEqual({ mit_bahn: false })
  })

  it('nimmt nur Felder, die das Modell kennt', () => {
    expect(bereinigeEingaben(felder, { cityname: 'Oelde', erfunden: 'x' })).toEqual({ cityname: 'Oelde' })
  })

  it('baut den Rumpf, den ein growbike-Lauf für Oelde wirklich braucht', () => {
    const rumpf = bereinigeEingaben(felder, {
      cityname: 'Oelde',
      crs_projected: '3857',
      seed_point_grid_spacing: 'auto',
      existing_network_spacing: '200',
      mit_bahn: 'false',
    })
    expect(rumpf).toEqual({ cityname: 'Oelde', existing_network_spacing: 200 })
  })
})
