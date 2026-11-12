import { describe, expect, it } from 'vitest'
import { checkNewAccount } from './accounts'

const valid = { username: 'Jane.Doe', email: 'jane@example.org', firstName: ' Jane ', lastName: 'Doe' }

describe('checkNewAccount', () => {
  it('accepts a valid account and normalises it', () => {
    expect(checkNewAccount(valid)).toEqual({
      account: { username: 'jane.doe', email: 'jane@example.org', firstName: 'Jane', lastName: 'Doe' },
      problems: [],
    })
  })

  it('rejects usernames with spaces, slashes or a leading dot', () => {
    for (const username of ['jane doe', 'a/b', '.jane', 'j', 'jd', '']) {
      expect(checkNewAccount({ ...valid, username }).problems).toContain('username')
    }
  })

  it('rejects a missing or malformed email', () => {
    for (const email of ['', 'jane', 'jane@', 'jane@example']) {
      expect(checkNewAccount({ ...valid, email }).problems).toContain('email')
    }
  })

  it('requires first and last name', () => {
    expect(checkNewAccount({ ...valid, firstName: '  ', lastName: '' }).problems).toEqual(['firstName', 'lastName'])
  })

  it('treats missing or non-string input as invalid', () => {
    expect(checkNewAccount(null).problems).toEqual(['username', 'email', 'firstName', 'lastName'])
    expect(checkNewAccount({ username: 42 }).problems).toContain('username')
  })
})
