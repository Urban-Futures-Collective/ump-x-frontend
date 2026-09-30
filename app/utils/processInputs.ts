// The single rule for turning form inputs into an execution body, shared by
// ProcessRunner and the chat so both build the same call.
//
// The core is omission. Some models declare integer inputs with the string
// "auto" as default; Number("auto") would be NaN and crash the process. Empty
// input therefore gets the backend default, by design.
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

    // Do not send empty values: the backend default applies.
    if (text === '') continue
    // Nor an unchanged default: resending it changes nothing and breaks for
    // "auto" in a number field.
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
