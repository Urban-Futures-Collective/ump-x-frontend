import { describe, expect, it } from 'vitest'
import { bereinigeEingaben, type EingabeFeld } from './processInputs'

// Diese Regel benutzen Formular und Chat gemeinsam. Zwei Fassungen davon hieße:
// der Chat baut einen Aufruf, der kippt, obwohl derselbe aus dem Formular
// durchgeht. Deshalb steht sie hier unter Test und nicht nur unter Kommentar.
//
// Die Funktion kennt keine Modelle, sie sieht nur Feldtypen. Die Felder hier
// sind deshalb keine echten, sondern ein Satz Formen, der jede Besonderheit
// abdeckt, die uns bisher Ärger gemacht hat.
const felder: EingabeFeld[] = [
  { name: 'pflichtfeld', type: 'string' },
  { name: 'text_mit_vorgabe', type: 'string', default: '3857' },
  { name: 'zahl_mit_wort_als_vorgabe', type: 'integer', default: 'auto' },
  { name: 'zahl_ohne_vorgabe', type: 'integer' },
  { name: 'schalter', type: 'boolean', default: 'false' },
]

describe('bereinigeEingaben', () => {
  it('lässt leere Eingaben weg, damit die Vorgabe des Backends greift', () => {
    expect(bereinigeEingaben(felder, { pflichtfeld: '', text_mit_vorgabe: '   ' })).toEqual({})
  })

  it('lässt fehlende Schlüssel weg', () => {
    expect(bereinigeEingaben(felder, {})).toEqual({})
  })

  it('schickt eine unveränderte Vorgabe nicht mit', () => {
    expect(bereinigeEingaben(felder, { text_mit_vorgabe: '3857' })).toEqual({})
  })

  it('schickt eine geänderte Vorgabe mit', () => {
    expect(bereinigeEingaben(felder, { text_mit_vorgabe: '3035' })).toEqual({ text_mit_vorgabe: '3035' })
  })

  // Der Fall, der uns früher gekippt ist: Number("auto") ist NaN.
  it('schickt die Vorgabe "auto" eines Zahlenfelds nicht als Zahl mit', () => {
    expect(bereinigeEingaben(felder, { zahl_mit_wort_als_vorgabe: 'auto' })).toEqual({})
  })

  it('lässt einen unbrauchbaren Wert in einem Zahlenfeld ganz weg', () => {
    expect(bereinigeEingaben(felder, { zahl_mit_wort_als_vorgabe: 'ungefähr 1000' })).toEqual({})
  })

  it('wandelt Zahlenfelder in Zahlen, nicht in Zeichenketten', () => {
    const rumpf = bereinigeEingaben(felder, { zahl_ohne_vorgabe: '200' })
    expect(rumpf).toEqual({ zahl_ohne_vorgabe: 200 })
    expect(typeof rumpf.zahl_ohne_vorgabe).toBe('number')
  })

  it('schneidet Leerraum ab, bevor es urteilt', () => {
    expect(bereinigeEingaben(felder, { pflichtfeld: '  Musterstadt  ' })).toEqual({ pflichtfeld: 'Musterstadt' })
    expect(bereinigeEingaben(felder, { text_mit_vorgabe: ' 3857 ' })).toEqual({})
  })

  it('versteht die üblichen Wahrheitswerte', () => {
    expect(bereinigeEingaben(felder, { schalter: 'true' })).toEqual({ schalter: true })
    expect(bereinigeEingaben(felder, { schalter: '1' })).toEqual({ schalter: true })
    expect(bereinigeEingaben(felder, { schalter: 'nein' })).toEqual({ schalter: false })
  })

  it('nimmt nur Felder, die das Modell kennt', () => {
    expect(bereinigeEingaben(felder, { pflichtfeld: 'Musterstadt', erfunden: 'x' })).toEqual({ pflichtfeld: 'Musterstadt' })
  })

  it('baut aus einem vollständig ausgefüllten Formular den richtigen Rumpf', () => {
    const rumpf = bereinigeEingaben(felder, {
      pflichtfeld: 'Musterstadt',
      text_mit_vorgabe: '3857',
      zahl_mit_wort_als_vorgabe: 'auto',
      zahl_ohne_vorgabe: '200',
      schalter: 'false',
    })
    expect(rumpf).toEqual({ pflichtfeld: 'Musterstadt', zahl_ohne_vorgabe: 200 })
  })
})
