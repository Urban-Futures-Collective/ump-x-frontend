// Roles from the signed-in user's current access token.
//
// The session cannot be trusted for this: nuxt-oidc-auth merges a refresh into the stored
// session with defu, which concatenates arrays, and never renews userInfo. A revoked role
// would stay in the session until the next login. The access token is replaced on every
// refresh, so a revoked role is gone at the latest when the token expires.
//
// The token comes from the encrypted server-side session store, so it is only decoded
// here, not verified again. UMP validates it itself.
export function tokenClaims(token: string | undefined | null): KeycloakRoleClaims {
  const payload = token?.split('.')[1]
  if (!payload) return {}
  try {
    const { realm_access, resource_access } = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
    return { realm_access, resource_access }
  }
  catch {
    return {}
  }
}

export const tokenRoles = (token: string | undefined | null): string[] => [...new Set(rolesFrom(tokenClaims(token)))]
