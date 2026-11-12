import { describe, expect, it } from 'vitest'
import { compareInterfaces, interfaceDiff, schemaSummary } from './interfaceChanges'

const verified = {
  inputs: {
    agents_per_10k: { title: 'Agents', schema: { type: 'integer', minimum: 1, maximum: 500 } },
    iterations: { schema: { type: 'integer' }, minOccurs: 0 },
  },
  outputs: {
    trip_table: { schema: { type: 'string', contentMediaType: 'text/csv' } },
    trips: { schema: { type: 'object' } },
  },
  jobControlOptions: ['async-execute'],
}
const live = {
  inputs: {
    agents_per_10k: { title: 'Agents per 10k', schema: { type: 'number', minimum: 0.1, maximum: 500 } },
    iterations: { description: 'new text only', schema: { type: 'integer' }, minOccurs: 0 },
    start_date: { schema: { type: 'string', format: 'date' } },
  },
  outputs: {
    trips: { schema: { type: 'object' } },
  },
  jobControlOptions: ['async-execute', 'sync-execute'],
}

describe('interface changes', () => {
  it('finds what changed and ignores text, like UMP', () => {
    expect(interfaceDiff(verified, live)).toEqual({
      inputs: { added: ['start_date'], removed: [], changed: ['agents_per_10k'] },
      outputs: { added: [], removed: ['trip_table'], changed: [] },
      jobControlOptions: { before: ['async-execute'], after: ['async-execute', 'sync-execute'] },
    })
    expect(interfaceDiff(verified, verified)).toEqual({})
  })

  it('makes rows with before and after', () => {
    const c = compareInterfaces(verified, live, interfaceDiff(verified, live))
    expect(c.rows).toEqual([
      { kind: 'added', name: 'start_date', output: false, before: '', after: 'date, required' },
      { kind: 'changed', name: 'agents_per_10k', output: false, before: 'integer, 1–500, required', after: 'number, 0.1–500, required' },
      { kind: 'removed', name: 'trip_table', output: true, before: 'text/csv', after: '' },
    ])
    expect(c.unchanged).toEqual(['iterations', '→ trips'])
    expect(c.modes).toEqual([{ key: 'jobControlOptions', before: 'async-execute', after: 'async-execute, sync-execute' }])
  })

  it('takes UMP\'s diff as it comes', () => {
    const c = compareInterfaces(verified, live, { inputs: { changed: ['iterations'] } })
    expect(c.rows).toEqual([{ kind: 'changed', name: 'iterations', output: false, before: 'integer, optional', after: 'integer, optional' }])
    expect(c.unchanged).toEqual(['agents_per_10k', '→ trip_table', '→ trips'])
  })

  it('summarises schemas', () => {
    expect(schemaSummary({ enum: ['a', 'b'] })).toBe('enum: a, b')
    expect(schemaSummary({ oneOf: [] })).toBe('object')
    expect(schemaSummary(undefined)).toBe('')
  })
})
