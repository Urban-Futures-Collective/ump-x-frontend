// Zugang zur Keycloak-Admin-API über das Dienstkonto `ump-x-admin`.
//
// Nie das Token der angemeldeten Person: dafür bräuchten echte Menschen
// realm-management-Rechte, und die lägen dann in einer Browser-Sitzung (F11). Das
// Dienstkonto meldet sich mit client_credentials an; sein Token bleibt auf dem Server
// und geht nie an den Browser.
//
// Das Konto darf viel (manage-users, manage-realm). Diese Datei ist deshalb bewusst
// KEIN allgemeiner Durchgang wie der /ump-Proxy: wer sie aufruft, muss vorher selbst
// geprüft haben, wer fragt und was er darf (requireRole, Allowlists). Jede Route ist
// eine einzelne, benannte Operation.

interface TokenCache { token: string, gueltigBis: number }
let cache: TokenCache | null = null

// Aus der OIDC-Adresse des Realms die beiden Adressen, die wir brauchen. Keycloak ab
// 17 hat kein /auth mehr davor, ältere Installationen schon; beides wird unterstützt,
// weil nur `/realms/` durch `/admin/realms/` ersetzt wird.
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

function einstellungen() {
  const config = useRuntimeConfig()
  const clientId = config.keycloakAdminClientId
  const clientSecret = config.keycloakAdminClientSecret
  const realmUrl = (config.oidc as { providers?: { keycloak?: { baseUrl?: string } } } | undefined)
    ?.providers?.keycloak?.baseUrl
  // 503 statt 500: nichts ist kaputt, es ist nur nicht eingerichtet. Genannt werden
  // die NAMEN der fehlenden Einstellungen, nie ihre Werte: so sieht man im Browser,
  // was in den Environment Settings fehlt, ohne dass ein Secret irgendwo erscheint.
  const fehlend = [
    !clientId && 'NUXT_KEYCLOAK_ADMIN_CLIENT_ID',
    !clientSecret && 'NUXT_KEYCLOAK_ADMIN_CLIENT_SECRET',
    !realmUrl && 'NUXT_OIDC_PROVIDERS_KEYCLOAK_BASE_URL',
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
  // 30 s Puffer, damit ein Token nicht zwischen Prüfung und Aufruf abläuft.
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
    // Token vorzeitig ungültig (Neustart von Keycloak, Secret gewechselt): einmal neu
    // holen, dann aufgeben.
    if ((e as { statusCode?: number }).statusCode === 401) {
      cache = null
      return await aufruf()
    }
    throw e
  }
}
