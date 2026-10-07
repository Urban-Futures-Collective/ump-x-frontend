import { describe, expect, it } from 'vitest'
import { choicesOf, inputGroup, inputKind, isRelevant } from './inputKinds'

// Shapes taken from the umep model server's process descriptions.
describe('inputKind', () => {
  it('picks the field from the schema', () => {
    expect(inputKind({ type: 'boolean' })).toBe('boolean')
    expect(inputKind({ type: 'object', schema: { format: 'geojson-geometry' } })).toBe('geometry')
    expect(inputKind({ type: 'string', schema: { enum: ['utci_max', 'utci_at_time'] } })).toBe('choice')
    expect(inputKind({ type: 'integer', schema: { enum: [10, 30, 60] } })).toBe('choice')
    expect(inputKind({ type: 'string', schema: { format: 'date' } })).toBe('date')
    expect(inputKind({ type: 'number', schema: { minimum: 1 } })).toBe('number')
    expect(inputKind({ type: 'string', schema: { pattern: '^\\d{2}:\\d{2}$' } })).toBe('text')
  })

  it('recognises a named choice or a date', () => {
    const weather = { type: 'string', schema: { oneOf: [{ enum: ['hot_day', 'typical_hot_day'] }, { format: 'date' }] } }
    expect(inputKind(weather)).toBe('choiceOrDate')
    expect(choicesOf(weather.schema)).toEqual(['hot_day', 'typical_hot_day'])
  })
})

describe('groups and relevance', () => {
  it('treats inputs without a group as main', () => {
    expect(inputGroup(undefined)).toBe('main')
    expect(inputGroup('advanced')).toBe('advanced')
    expect(inputGroup('other')).toBe('main')
  })

  it('shows an input only for the listed values of another input', () => {
    const rule = { indicator: ['utci_at_time'] }
    expect(isRelevant(rule, { indicator: 'utci_at_time' })).toBe(true)
    expect(isRelevant(rule, { indicator: 'utci_max' })).toBe(false)
    expect(isRelevant(undefined, {})).toBe(true)
    expect(isRelevant({ interval_minutes: [30] }, { interval_minutes: '30' })).toBe(true)
  })
})
