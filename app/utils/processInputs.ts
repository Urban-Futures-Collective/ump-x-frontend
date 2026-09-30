// The single rule for turning form inputs into an execution body, shared by
// ProcessRunner and the chat so both build the same call.
//
// The core is omission. Some models declare integer inputs with the string
// "auto" as default; Number("auto") would be NaN and crash the process. Empty
// input therefore gets the backend default, by design.
export interface InputField {
  name: string
  type: string
  default?: unknown
}

export function cleanInputs(
  fields: InputField[],
  values: Record<string, unknown>,
): Record<string, unknown> {
  const body: Record<string, unknown> = {}

  for (const field of fields) {
    const raw = values[field.name]
    const text = raw == null ? '' : String(raw).trim()
    const defaultText = field.default != null ? String(field.default) : ''

    // Do not send empty values: the backend default applies.
    if (text === '') continue
    // Nor an unchanged default: resending it changes nothing and breaks for
    // "auto" in a number field.
    if (defaultText !== '' && text === defaultText) continue

    if (field.type === 'integer' || field.type === 'number') {
      if (Number.isFinite(Number(text))) body[field.name] = Number(text)
      continue
    }
    if (field.type === 'boolean') {
      body[field.name] = text === 'true' || text === '1'
      continue
    }
    body[field.name] = text
  }

  return body
}
