// Reads the signed-in user's roles from the OIDC session. Components and guards only ask
// for roles/isAdmin/modelServerRoles; no extra network call.
//
// BFF: access and ID tokens are stripped from the client session (oidc-strip-token.ts),
// so roles must come from session fields that survive. nuxt-oidc-auth fills two of them,
// depending on where Keycloak's roles mapper puts the roles:
//   - user.userInfo: the full /userinfo response (mapper "Add to userinfo")
//   - user.claims:   only ID token claims extracted via `optionalClaims` (see nuxt.config)
// Both are read and merged, so either mapper target works.
//
// The role vocabulary and parsing live in shared/utils/roles.ts because the server checks
// the same names in the admin routes.

export function useUmpRoles() {
  const { loggedIn, user } = useOidcAuth()

  const roles = computed<string[]>(() => {
    if (!loggedIn.value) return []
    return rolesOfSession(user.value)
  })

  // Model access roles: `modelserver` (all) and `modelserver_<id>` (per model server).
  // UMP filters the process list server-side by these; here mainly for display.
  const modelServerRoles = computed(() =>
    roles.value.filter(r => r === 'modelserver' || r.startsWith('modelserver_')),
  )

  // Admin gate based only on the admin roles from the token. Exposed separately because
  // the admin portal shows different sections per role.
  const isAccessAdmin = computed(() => roles.value.includes(ROLE_ACCESS_ADMIN))
  const isPlatformAdmin = computed(() => roles.value.includes(ROLE_PLATFORM_ADMIN))
  const isAdmin = computed(() => isAccessAdmin.value || isPlatformAdmin.value)
  // Model registry roles: providers contribute models, verifiers review them.
  const isProvider = computed(() => roles.value.includes(ROLE_PROVIDER))
  const isVerifier = computed(() => roles.value.includes(ROLE_VERIFIER))

  return { roles, modelServerRoles, isAdmin, isAccessAdmin, isPlatformAdmin, isProvider, isVerifier }
}
