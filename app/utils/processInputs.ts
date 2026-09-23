// Die eine Regel, wie Formulareingaben zu einem Ausführungs-Rumpf werden.
//
// Ausgelagert aus ProcessRunner, weil der Chat sie ab Schritt 3 auch braucht.
// Zwei Fassungen dieser Regel hieße: der Chat baut einen Aufruf, der kippt,
// obwohl derselbe Aufruf aus dem Formular durchgeht.
//
// Der Kern ist das Weglassen. growbike führt Integer-Eingaben mit dem String
// "auto" als Vorgabe; ein Number("auto") wäre NaN und brächte den Prozess zum
// Absturz. Wer nichts einträgt, bekommt deshalb die Vorgabe des Backends, und
// das ist gewollt, nicht bequem.
export interface EingabeFeld {
  name: string
  type: string
  default?: unknown
}

export function bereinigeEingaben(
  felder: EingabeFeld[],
  werte: Record<string, unknown>,
): Record<string, unknown> {
  const rumpf: Record<string, unknown> = {}

  for (const feld of felder) {
    const roh = werte[feld.name]
    const text = roh == null ? '' : String(roh).trim()
    const vorgabe = feld.default != null ? String(feld.default) : ''

    // Leeres nicht senden: dann gilt die Vorgabe des Backends.
    if (text === '') continue
    // Unveränderte Vorgabe auch nicht: sie noch einmal zu schicken ändert
    // nichts und geht bei "auto" in einem Zahlenfeld sogar schief.
    if (vorgabe !== '' && text === vorgabe) continue

    if (feld.type === 'integer' || feld.type === 'number') {
      if (Number.isFinite(Number(text))) rumpf[feld.name] = Number(text)
      continue
    }
    if (feld.type === 'boolean') {
      rumpf[feld.name] = text === 'true' || text === '1'
      continue
    }
    rumpf[feld.name] = text
  }

  return rumpf
}
