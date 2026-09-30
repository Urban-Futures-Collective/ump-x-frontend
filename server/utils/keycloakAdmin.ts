// Access to the Keycloak Admin REST API through a dedicated service account.
//
// Never the signed-in user's token: that would require real people to hold
// realm-management permissions inside a browser session. The service account uses
// client_credentials; its token stays on the server and never reaches the browser.
//
// The account is powerful (manage-users, manage-realm), so this is deliberately NOT a
// generic passthrough like the /ump proxy: callers must first check who is asking and
// what they may do (requireRole, allowlists). Each route is one named operation.

interface TokenCache { token: string, validUntil: number }
let cache: TokenCache | null = null

// Derive the two URLs we need from the realm's OIDC URL. Keycloak 17+ has no /auth
// prefix, older installations do; both work because only `/realms/` is replaced by
// `/admin/realms/`.
export function keycloakAdminUrls(realmUrl: string) {
  const base = realmUrl.replace(/\/+$/, '')
  if (!/\/realms\/[^/]+$/.test(base)) {
    throw new Error(`Keine Realm-Adresse: ${realmUrl}`)
  }
  return {
    token: `${base}/protocol/openid-connect/token`,
    admin: base.replace(/\/realms\/([^/]+)$/, '/admin/realms/$1'),
  }
}

// Realm URL at runtime. NUXT_OIDC_PROVIDERS_KEYCLOAK_BASE_URL is a build argument
// (see docs/deployment-de.md): nuxt-oidc-auth builds full URLs such as `tokenUrl` from it
// at build time, while `baseUrl` itself is empty at runtime. So derive the realm URL from
// `tokenUrl` first and fall back to `baseUrl`.
export function realmUrlFrom(provider: { baseUrl?: string, tokenUrl?: string } | undefined): string | undefined {
  const fromToken = provider?.tokenUrl?.replace(/\/protocol\/openid-connect\/token\/?$/, '')
  if (fromToken && fromToken !== provider?.tokenUrl && /^https?:\/\//.test(fromToken)) return fromToken
  return provider?.baseUrl || undefined
}

function settings() {
  const config = useRuntimeConfig()
  const clientId = config.keycloakAdminClientId
  const clientSecret = config.keycloakAdminClientSecret
  const realmUrl = realmUrlFrom(
    (config.oidc as { providers?: { keycloak?: { baseUrl?: string, tokenUrl?: string } } } | undefined)
      ?.providers?.keycloak,
  )
  // 503 rather than 500: nothing is broken, it is just not configured. Only the NAMES of
  // missing settings are reported, never their values, so the browser shows what is
  // missing without exposing a secret.
  const missing = [
    !clientId && 'NUXT_KEYCLOAK_ADMIN_CLIENT_ID',
    !clientSecret && 'NUXT_KEYCLOAK_ADMIN_CLIENT_SECRET',
    !realmUrl && 'NUXT_OIDC_PROVIDERS_KEYCLOAK_BASE_URL (Build-Argument)',
  ].filter(Boolean)
  if (missing.length) {
    console.warn(`[admin] Keycloak-Admin-Zugang nicht eingerichtet, es fehlt: ${missing.join(', ')}`)
    throw createError({
      statusCode: 503,
      statusMessage: `Keycloak-Admin-Zugang ist nicht eingerichtet, es fehlt: ${missing.join(', ')}`,
    })
  }
  return { clientId, clientSecret, ...keycloakAdminUrls(realmUrl!) }
}

async function serviceAccountToken(): Promise<string> {
  // 30 s margin so a token cannot expire between check and call.
  if (cache && cache.validUntil > Date.now() + 30_000) return cache.token
  const { clientId, clientSecret, token } = settings()
  const response = await $fetch<{ access_token: string, expires_in: number }>(token, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'client_credentials', client_id: clientId, client_secret: clientSecret }).toString(),
  })
  cache = { token: response.access_token, validUntil: Date.now() + response.expires_in * 1000 }
  return cache.token
}

export async function keycloakAdmin<T>(
  path: string,
  options: { method?: 'GET' | 'POST' | 'PUT' | 'DELETE', query?: Record<string, string | number | boolean>, body?: unknown } = {},
): Promise<T> {
  const { admin } = settings()
  // Cast: Nitro types $fetch for its own routes; this is an external URL.
  const call = async () => ($fetch(`${admin}${path}`, {
    method: options.method ?? 'GET',
    query: options.query,
    body: options.body as Record<string, unknown> | undefined,
    headers: { authorization: `Bearer ${await serviceAccountToken()}` },
  }) as Promise<T>)
  try {
    return await call()
  }
  catch (e) {
    // Token invalidated early (Keycloak restart, rotated secret): fetch a new one once,
    // then give up.
    if ((e as { statusCode?: number }).statusCode === 401) {
      cache = null
      return await call()
    }
    throw e
  }
}
