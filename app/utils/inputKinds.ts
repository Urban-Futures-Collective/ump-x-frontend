import { isGeometryInput } from './geometryInput'

// Which form field an input gets, read from its JSON Schema, plus the grouping hints a
// model server can add (`x-ump-group`, `x-ump-relevant-if`). Everything here works from
// the schema alone, so any model that describes its inputs well gets fitting fields.

export type InputKind
  = | 'boolean'
    | 'geometry'
    | 'choice'
    | 'choiceOrDate'
    | 'date'
    | 'number'
    | 'text'

type Schema = Record<string, unknown> | undefined

const isDateSchema = (s: unknown) => !!s && typeof s === 'object' && (s as Record<string, unknown>).format === 'date'
const enumOf = (s: unknown) => (s && typeof s === 'object' && Array.isArray((s as Record<string, unknown>).enum))
  ? (s as { enum: unknown[] }).enum
  : null

// The fixed values an input offers: its own enum, or the enum of a oneOf branch (as
// with a weather input that takes a named scenario or a date).
export function choicesOf(schema: Schema): unknown[] {
  const own = enumOf(schema)
  if (own) return own
  for (const branch of (schema?.oneOf as unknown[] | undefined) ?? []) {
    const e = enumOf(branch)
    if (e) return e
  }
  return []
}

export function inputKind(input: { type: string, schema?: Record<string, unknown> }): InputKind {
  const schema = input.schema
  if (input.type === 'boolean') return 'boolean'
  if (isGeometryInput(schema)) return 'geometry'
  if (enumOf(schema)) return 'choice'
  const branches = (schema?.oneOf as unknown[] | undefined) ?? []
  if (branches.some(b => enumOf(b)) && branches.some(isDateSchema)) return 'choiceOrDate'
  if (isDateSchema(schema)) return 'date'
  if (input.type === 'integer' || input.type === 'number') return 'number'
  return 'text'
}

export type InputGroup = 'main' | 'scenario' | 'advanced'

// `x-ump-group`; inputs without it count as main, so a model without hints shows every
// input as before.
export function inputGroup(raw: unknown): InputGroup {
  return raw === 'scenario' || raw === 'advanced' ? raw : 'main'
}

// `x-ump-relevant-if`: the input only matters while other inputs have one of the listed
// values. Values are compared as text, because the form holds text.
export function isRelevant(relevantIf: Record<string, unknown[]> | undefined, values: Record<string, string>): boolean {
  if (!relevantIf) return true
  return Object.entries(relevantIf).every(([name, allowed]) =>
    Array.isArray(allowed) && allowed.map(String).includes(values[name] ?? ''))
}
