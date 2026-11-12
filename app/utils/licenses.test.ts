import { describe, expect, it } from 'vitest'
import { knownLicense, LICENSES } from './licenses'

describe('licences', () => {
  it('uses unique SPDX identifiers', () => {
    expect(new Set(LICENSES.map(l => l.value)).size).toBe(LICENSES.length)
  })

  it('finds a listed licence regardless of case and spaces', () => {
    expect(knownLicense(' mit ')?.value).toBe('MIT')
    expect(knownLicense('apache-2.0')?.value).toBe('Apache-2.0')
  })

  it('treats anything else as an own licence', () => {
    expect(knownLicense('Apache 2')).toBeUndefined()
    expect(knownLicense('')).toBeUndefined()
  })
})
