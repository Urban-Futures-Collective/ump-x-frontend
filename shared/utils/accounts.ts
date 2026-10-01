// Input rules for creating an account, shared by the server route (which enforces
// them) and the form (which can show them early).

export interface NewAccount {
  username: string
  email: string
  firstName: string
  lastName: string
}

// Keycloak stores usernames in lower case; restrict to characters that are safe in
// URLs and logs.
const USERNAME = /^[a-z0-9][a-z0-9._-]{1,49}$/
// Deliberately simple: Keycloak and the mail server decide the rest.
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export type NewAccountProblem = 'username' | 'email' | 'firstName' | 'lastName'

export function checkNewAccount(input: unknown): { account: NewAccount, problems: [] } | { account: null, problems: NewAccountProblem[] } {
  const raw = (input ?? {}) as Record<string, unknown>
  const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
  const account: NewAccount = {
    username: text(raw.username).toLowerCase(),
    email: text(raw.email),
    firstName: text(raw.firstName),
    lastName: text(raw.lastName),
  }
  const problems: NewAccountProblem[] = []
  if (!USERNAME.test(account.username)) problems.push('username')
  if (!EMAIL.test(account.email) || account.email.length > 254) problems.push('email')
  if (!account.firstName || account.firstName.length > 100) problems.push('firstName')
  if (!account.lastName || account.lastName.length > 100) problems.push('lastName')
  return problems.length ? { account: null, problems } : { account, problems: [] }
}
