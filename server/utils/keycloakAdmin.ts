// Access to the Keycloak Admin REST API through a dedicated service account.
//
// Never the signed-in user's token: that would require real people to hold
// realm-management permissions inside a browser session. The service account uses
// client_credentials; its token stays on the server and never reaches the browser.
//
// The account is powerful (manage-users, manage-realm), so this is deliberately NOT a
// generic passthrough like the /ump proxy: callers must first check who is asking and
// what they may do (requireRole, allowlists). Each route is one named operation.

interface TokenCache { token: string, gueltigBis: number }
let cache: TokenCache | null = null

// Derive the two URLs we need from the realm's OIDC URL. Keycloak 17+ has no /auth
// prefix, older installations do; both work because only `/realms/` is replaced by
// `/admin/realms/`.
export function keycloakAdminUrls(realmUrl: string) {
  const basis = realmUrl.replace(/\/+$/, '')
  if (!/\/realms\/[^/]+$/.test(basis)) {
    throw new Error(`Keine Realm-Adresse: ${realmUrl}`)
  }
  return {
    token: `${basis}/protocol/openid-connect/token`,
    admin: basis.replace(/\/realms\/([^/]+)$/, '/admin/realms/$1'),
  }
}

// Realm URL at runtime. NUXT_OIDC_PROVIDERS_KEYCLOAK_BASE_URL is a build argument
// (see docs/deployment-de.md): nuxt-oidc-auth builds full URLs such as `tokenUrl` from it
// at build time, while `baseUrl` itself is empty at runtime. So derive the realm URL from
// `tokenUrl` first and fall back to `baseUrl`.
export function realmUrlAus(provider: { baseUrl?: string, tokenUrl?: string } | undefined): string | undefined {
  const ausToken = provider?.tokenUrl?.replace(/\/protocol\/openid-connect\/token\/?$/, '')
  if (ausToken && ausToken !== provider?.tokenUrl && /^https?:\/\//.test(ausToken)) return ausToken
  return provider?.baseUrl || undefined
}

function einstellungen() {
  const config = useRuntimeConfig()
  const clientId = config.keycloakAdminClientId
  const clientSecret = config.keycloakAdminClientSecret
  const realmUrl = realmUrlAus(
    (config.oidc as { providers?: { keycloak?: { baseUrl?: string, tokenUrl?: string } } } | undefined)
      ?.providers?.keycloak,
  )
  // 503 rather than 500: nothing is broken, it is just not configured. Only the NAMES of
  // missing settings are reported, never their values, so the browser shows what is
  // missing without exposing a secret.
  const fehlend = [
    !clientId && 'NUXT_KEYCLOAK_ADMIN_CLIENT_ID',
    !clientSecret && 'NUXT_KEYCLOAK_ADMIN_CLIENT_SECRET',
    !realmUrl && 'NUXT_OIDC_PROVIDERS_KEYCLOAK_BASE_URL (Build-Argument)',
  ].filter(Boolean)
  if (fehlend.length) {
    console.warn(`[admin] Keycloak-Admin-Zugang nicht eingerichtet, es fehlt: ${fehlend.join(', ')}`)
    throw createError({
      statusCode: 503,
      statusMessage: `Keycloak-Admin-Zugang ist nicht eingerichtet, es fehlt: ${fehlend.join(', ')}`,
    })
  }
  return { clientId, clientSecret, ...keycloakAdminUrls(realmUrl) }
}

async function dienstkontoToken(): Promise<string> {
  // 30 s margin so a token cannot expire between check and call.
  if (cache && cache.gueltigBis > Date.now() + 30_000) return cache.token
  const { clientId, clientSecret, token } = einstellungen()
  const antwort = await $fetch<{ access_token: string, expires_in: number }>(token, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'client_credentials', client_id: clientId, client_secret: clientSecret }).toString(),
  })
  cache = { token: antwort.access_token, gueltigBis: Date.now() + antwort.expires_in * 1000 }
  return cache.token
}

export async function keycloakAdmin<T>(
  pfad: string,
  optionen: { method?: 'GET' | 'POST' | 'PUT' | 'DELETE', query?: Record<string, string | number | boolean>, body?: unknown } = {},
): Promise<T> {
  const { admin } = einstellungen()
  const aufruf = async () => $fetch<T>(`${admin}${pfad}`, {
    method: optionen.method ?? 'GET',
    query: optionen.query,
    body: optionen.body as Record<string, unknown> | undefined,
    headers: { authorization: `Bearer ${await dienstkontoToken()}` },
  })
  try {
    return await aufruf()
  }
  catch (e) {
    // Token invalidated early (Keycloak restart, rotated secret): fetch a new one once,
    // then give up.
    if ((e as { statusCode?: number }).statusCode === 401) {
      cache = null
      return await aufruf()
    }
    throw e
  }
}
