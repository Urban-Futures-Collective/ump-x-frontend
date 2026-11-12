// Comparing the interface a model was verified against with what its server describes
// now (design V3, UMP "interface drift"). UMP decides what counts as a change: it hashes
// the process description without titles, descriptions, links and metadata, and its
// diff lists the input and output ids that differ. This file turns that into rows a
// verifier can read: one line per change, before and after as a short summary.

type Json = Record<string, unknown>

export interface InterfaceChangeRow {
  kind: 'added' | 'changed' | 'removed'
  /** Input or output id; outputs are shown with a leading arrow. */
  name: string
  output: boolean
  before: string
  after: string
}

export interface InterfaceComparison {
  rows: InterfaceChangeRow[]
  /** Inputs and outputs that did not change (outputs with a leading arrow). */
  unchanged: string[]
  /** jobControlOptions / outputTransmission, when they changed. */
  modes: { key: string, before: string, after: string }[]
}

/** The diff UMP returns from GET /registry/v1/models/{id}/interface. */
export interface InterfaceDiff {
  inputs?: { added?: string[], removed?: string[], changed?: string[] }
  outputs?: { added?: string[], removed?: string[], changed?: string[] }
  jobControlOptions?: { before?: unknown, after?: unknown }
  outputTransmission?: { before?: unknown, after?: unknown }
}

const asMap = (v: unknown): Record<string, Json> => (v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, Json> : {})
const section = (d: unknown, key: 'inputs' | 'outputs') => asMap(asMap(d)[key])

/** Short type line for a JSON schema, e.g. "integer, 1–500" or "enum: a, b". */
export function schemaSummary(schema: unknown): string {
  const s = asMap(schema) as Json
  if (Array.isArray(s.enum)) return `enum: ${s.enum.join(', ')}`
  const range = s.minimum !== undefined && s.maximum !== undefined ? `, ${s.minimum}–${s.maximum}` : ''
  if (typeof s.contentMediaType === 'string') return s.contentMediaType
  if (typeof s.format === 'string' && (s.type === 'string' || s.type === undefined)) return `${s.format}${range}`
  if (typeof s.type === 'string') return `${s.type}${range}`
  if (Array.isArray(s.oneOf) || Array.isArray(s.anyOf)) return 'object'
  return ''
}

/** Words the page passes in its language. */
export interface SummaryWords { required: string, optional: string }

// OGC API Processes: minOccurs defaults to 1, so an input is required unless it says 0.
function inputSummary(def: Json, words: SummaryWords): string {
  const required = def.minOccurs === undefined || Number(def.minOccurs) > 0
  return [schemaSummary(def.schema), required ? words.required : words.optional].filter(Boolean).join(', ')
}

function outputSummary(def: Json): string {
  return schemaSummary(def.schema)
}

// Same rule as UMP's interface hash: text keys are left out at every level, except
// where keys are names (properties maps); data keywords are kept verbatim.
const TEXT_KEYS = new Set(['title', 'description', 'links', 'metadata'])
const NAME_MAPS = new Set(['properties', 'patternProperties', '$defs', 'definitions'])
const DATA_KEYWORDS = new Set(['default', 'enum', 'const', 'example', 'examples'])
function canonical(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(canonical)
  if (!node || typeof node !== 'object') return node
  const out: Json = {}
  for (const key of Object.keys(node as Json).sort()) {
    const value = (node as Json)[key]
    if (TEXT_KEYS.has(key)) continue
    if (DATA_KEYWORDS.has(key)) out[key] = value
    else if (NAME_MAPS.has(key) && value && typeof value === 'object') {
      out[key] = Object.fromEntries(Object.keys(value as Json).sort().map(k => [k, canonical((value as Json)[k])]))
    }
    else out[key] = canonical(value)
  }
  return out
}
const same = (a: unknown, b: unknown) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b))

/**
 * UMP's diff worked out locally, for the sample data (UMP sends its own). Ids that are
 * in both descriptions but differ outside of text count as changed.
 */
export function interfaceDiff(before: unknown, after: unknown): InterfaceDiff {
  const out: InterfaceDiff = {}
  for (const key of ['inputs', 'outputs'] as const) {
    const old = section(before, key)
    const now = section(after, key)
    const changes = {
      added: Object.keys(now).filter(k => !(k in old)).sort(),
      removed: Object.keys(old).filter(k => !(k in now)).sort(),
      changed: Object.keys(old).filter(k => k in now && !same(old[k], now[k])).sort(),
    }
    if (changes.added.length || changes.removed.length || changes.changed.length) out[key] = changes
  }
  for (const key of ['jobControlOptions', 'outputTransmission'] as const) {
    const a = asMap(before)[key]
    const b = asMap(after)[key]
    if (!same(a, b)) out[key] = { before: a, after: b }
  }
  return out
}

const modeText = (v: unknown) => Array.isArray(v) ? v.join(', ') : v === undefined || v === null ? '' : String(v)

/** Rows for the comparison table: added and changed first, then removed. */
export function compareInterfaces(
  verified: unknown,
  live: unknown,
  diff: InterfaceDiff,
  words: SummaryWords = { required: 'required', optional: 'optional' },
): InterfaceComparison {
  const rows: InterfaceChangeRow[] = []
  const unchanged: string[] = []
  for (const key of ['inputs', 'outputs'] as const) {
    const output = key === 'outputs'
    const summary = (def: Json) => output ? outputSummary(def) : inputSummary(def, words)
    const old = section(verified, key)
    const now = section(live, key)
    const d = diff[key] ?? {}
    const touched = new Set([...(d.added ?? []), ...(d.removed ?? []), ...(d.changed ?? [])])
    for (const name of d.added ?? []) rows.push({ kind: 'added', name, output, before: '', after: summary(now[name] ?? {}) })
    for (const name of d.changed ?? []) rows.push({ kind: 'changed', name, output, before: summary(old[name] ?? {}), after: summary(now[name] ?? {}) })
    for (const name of d.removed ?? []) rows.push({ kind: 'removed', name, output, before: summary(old[name] ?? {}), after: '' })
    for (const name of Object.keys(old)) if (!touched.has(name)) unchanged.push(output ? `→ ${name}` : name)
  }
  const order = { added: 0, changed: 1, removed: 2 }
  rows.sort((a, b) => order[a.kind] - order[b.kind])
  const modes = (['jobControlOptions', 'outputTransmission'] as const)
    .filter(k => diff[k])
    .map(k => ({ key: k, before: modeText(diff[k]!.before), after: modeText(diff[k]!.after) }))
  return { rows, unchanged, modes }
}
