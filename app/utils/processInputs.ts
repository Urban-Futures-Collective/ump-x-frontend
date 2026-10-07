import { choicesOf } from './inputKinds'

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
    // Objects and arrays (e.g. a drawn geometry) are held as JSON text in the form.
    // Text that is not JSON is not sent; inputProblem reports it.
    if (field.type === 'object' || field.type === 'array') {
      try {
        body[field.name] = JSON.parse(text)
      }
      catch {
        // Reported by inputProblem.
      }
      continue
    }
    body[field.name] = text
  }

  return body
}

// What is wrong with one input, checked in the form before sending so the user does not
// wait for the model server to reject it. Only rules the schema states are checked:
// required, number type, minimum, maximum and pattern. Rules that live only in a
// description ("give either place or area") are left to the model server.
export interface InputRule extends InputField {
  required?: boolean
  schema?: Record<string, unknown>
}

export type InputProblem
  = | { key: 'required' }
    | { key: 'number' }
    | { key: 'minimum', limit: number }
    | { key: 'maximum', limit: number }
    | { key: 'above', limit: number }
    | { key: 'below', limit: number }
    | { key: 'pattern', pattern: string }
    | { key: 'json' }
    | { key: 'choice' }
    | { key: 'date' }

export function inputProblem(field: InputRule, value: unknown): InputProblem | null {
  const text = value == null ? '' : String(value).trim()
  if (text === '') return field.required ? { key: 'required' } : null
  // An unchanged default is not sent (see cleanInputs), so it cannot be wrong. This
  // covers number fields whose default is a word such as "auto".
  if (field.default != null && text === String(field.default)) return null

  const schema = field.schema ?? {}

  // Fixed values, possibly next to a date (oneOf): one of the values or a valid date.
  const choices = choicesOf(schema)
  const takesDate = schema.format === 'date'
    || ((schema.oneOf as unknown[] | undefined) ?? []).some(b => (b as { format?: unknown })?.format === 'date')
  if (choices.length || takesDate) {
    if (choices.map(String).includes(text)) return null
    if (takesDate) return isDate(text) ? null : (choices.length ? { key: 'choice' } : { key: 'date' })
    return { key: 'choice' }
  }

  if (field.type === 'object' || field.type === 'array') {
    try {
      JSON.parse(text)
      return null
    }
    catch {
      return { key: 'json' }
    }
  }
  if (field.type === 'integer' || field.type === 'number') {
    const n = Number(text)
    if (!Number.isFinite(n) || (field.type === 'integer' && !Number.isInteger(n))) return { key: 'number' }
    if (typeof schema.minimum === 'number' && n < schema.minimum) return { key: 'minimum', limit: schema.minimum }
    if (typeof schema.maximum === 'number' && n > schema.maximum) return { key: 'maximum', limit: schema.maximum }
    if (typeof schema.exclusiveMinimum === 'number' && n <= schema.exclusiveMinimum) return { key: 'above', limit: schema.exclusiveMinimum }
    if (typeof schema.exclusiveMaximum === 'number' && n >= schema.exclusiveMaximum) return { key: 'below', limit: schema.exclusiveMaximum }
    return null
  }

  if (typeof schema.pattern === 'string') {
    let re: RegExp
    try {
      re = new RegExp(schema.pattern)
    }
    catch {
      // A pattern JavaScript cannot read is the model server's to check.
      return null
    }
    if (!re.test(text)) return { key: 'pattern', pattern: schema.pattern }
  }
  return null
}

// A calendar date as YYYY-MM-DD (JSON Schema `format: date`) that actually exists.
function isDate(text: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false
  const d = new Date(`${text}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(text)
}
