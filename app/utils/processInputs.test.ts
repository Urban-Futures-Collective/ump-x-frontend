import { describe, expect, it } from 'vitest'
import { cleanInputs, type InputField } from './processInputs'

// Form and chat share this rule; two copies would mean the chat builds a call
// that fails while the same call from the form succeeds. Hence the tests.
//
// The function knows no models, only field types. The fields here are not real
// ones but a set of shapes covering every edge case seen so far.
const fields: InputField[] = [
  { name: 'required_field', type: 'string' },
  { name: 'text_with_default', type: 'string', default: '3857' },
  { name: 'number_with_word_default', type: 'integer', default: 'auto' },
  { name: 'number_without_default', type: 'integer' },
  { name: 'toggle', type: 'boolean', default: 'false' },
]

describe('cleanInputs', () => {
  it('omits empty inputs so the backend default applies', () => {
    expect(cleanInputs(fields, { required_field: '', text_with_default: '   ' })).toEqual({})
  })

  it('omits missing keys', () => {
    expect(cleanInputs(fields, {})).toEqual({})
  })

  it('does not send an unchanged default', () => {
    expect(cleanInputs(fields, { text_with_default: '3857' })).toEqual({})
  })

  it('sends a changed default', () => {
    expect(cleanInputs(fields, { text_with_default: '3035' })).toEqual({ text_with_default: '3035' })
  })

  // Number("auto") is NaN, so this default must not be sent as a number.
  it('does not send the "auto" default of a number field as a number', () => {
    expect(cleanInputs(fields, { number_with_word_default: 'auto' })).toEqual({})
  })

  it('drops an unusable value in a number field entirely', () => {
    expect(cleanInputs(fields, { number_with_word_default: 'ungefähr 1000' })).toEqual({})
  })

  it('converts number fields to numbers, not strings', () => {
    const body = cleanInputs(fields, { number_without_default: '200' })
    expect(body).toEqual({ number_without_default: 200 })
    expect(typeof body.number_without_default).toBe('number')
  })

  it('trims whitespace before deciding', () => {
    expect(cleanInputs(fields, { required_field: '  Musterstadt  ' })).toEqual({ required_field: 'Musterstadt' })
    expect(cleanInputs(fields, { text_with_default: ' 3857 ' })).toEqual({})
  })

  it('understands the usual boolean values', () => {
    expect(cleanInputs(fields, { toggle: 'true' })).toEqual({ toggle: true })
    expect(cleanInputs(fields, { toggle: '1' })).toEqual({ toggle: true })
    expect(cleanInputs(fields, { toggle: 'nein' })).toEqual({ toggle: false })
  })

  it('keeps only fields the model knows', () => {
    expect(cleanInputs(fields, { required_field: 'Musterstadt', made_up: 'x' })).toEqual({ required_field: 'Musterstadt' })
  })

  it('builds the right body from a fully filled form', () => {
    const body = cleanInputs(fields, {
      required_field: 'Musterstadt',
      text_with_default: '3857',
      number_with_word_default: 'auto',
      number_without_default: '200',
      toggle: 'false',
    })
    expect(body).toEqual({ required_field: 'Musterstadt', number_without_default: 200 })
  })
})
