import { describe, expect, it } from 'vitest'
import { bereinigeEingaben, type EingabeFeld } from './processInputs'

// Form and chat share this rule; two copies would mean the chat builds a call
// that fails while the same call from the form succeeds. Hence the tests.
//
// The function knows no models, only field types. The fields here are not real
// ones but a set of shapes covering every edge case seen so far.
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

  // Number("auto") is NaN, so this default must not be sent as a number.
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
