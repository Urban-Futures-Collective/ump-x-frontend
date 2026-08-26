// getUserSession wird vom Modul NICHT server-auto-importiert (nur sessionHooks),
// daher expliziter Import aus dem Runtime-Subpfad.
import { getUserSession } from 'nuxt-oidc-auth/runtime/server/utils/session.js'

// Werden 1:1 vom Original-Request übernommen, außer diesen (host/connection sind
// hop-by-hop bzw. request-spezifisch; content-length wird von fetch() neu berechnet).
//
// cookie und authorization sind bewusst dabei: Das nuxt-oidc-auth-Session-Cookie hat
// beim UMP-Backend nichts zu suchen, und NUXT_UMP_API_TARGET zeigt auf eine oeffentliche
// Domain, der Request laeuft also nach aussen. Ein mitgeschicktes authorization wuerde
// ausserdem nur dann ueberschrieben, wenn zufaellig eine Session existiert; den Bearer
// setzen wir unten selbst aus der Session.
const SKIP_REQUEST_HEADERS = new Set([
  'host',
  'connection',
  'content-length',
  'cookie',
  'authorization',
])
// content-length/transfer-encoding/connection setzen wir über den gepufferten Body neu;
// content-encoding passt nicht mehr, weil fetch() die Antwort bereits entpackt hat.
const SKIP_RESPONSE_HEADERS = new Set(['content-length', 'transfer-encoding', 'connection', 'content-encoding'])

// Authentifizierter Proxy /ump/** → UMP-API. Injiziert den Access-Token aus der
// OIDC-Session als Bearer (nur wenn eingeloggt → anonymer Read-Modus bleibt möglich).
// Dies ist die eine Naht, an der wir später von localhost:5003 auf Ricos Backend
// umstecken (nur NUXT_UMP_API_TARGET tauschen). Siehe docs/frontend-backend-architecture.md.
export default defineEventHandler(async (event) => {
  const { umpApiTarget } = useRuntimeConfig(event)

  const path = getRouterParam(event, 'path') ?? ''
  const search = getRequestURL(event).search // z. B. ?f=json
  const target = `${umpApiTarget}/${path}${search}`

  const headers: Record<string, string> = {}
  for (const [key, value] of Object.entries(getRequestHeaders(event))) {
    if (value !== undefined && !SKIP_REQUEST_HEADERS.has(key.toLowerCase())) {
      headers[key] = value
    }
  }
  // getUserSession liefert {} ohne Session; accessToken nur bei exposeAccessToken (server-side).
  const session = await getUserSession(event).catch(() => null)
  if (session?.accessToken) {
    headers.authorization = `Bearer ${session.accessToken}`
  }

  const method = event.node.req.method ?? 'GET'
  const body = method === 'GET' || method === 'HEAD' ? undefined : await readRawBody(event)

  // Gepuffert statt gestreamt (statt proxyRequest()): auf ump-x-staging kam die
  // gestreamte/chunked Antwort hinter Traefik nie an — der Request landete stattdessen
  // bei Nuxts eigenem 404-Fallback. Volles Puffern umgeht das, unabhängig von der
  // genauen Ursache auf Traefik-Seite. Die Content-Length ergänzt Nitro selbst, sobald
  // wir einen Buffer zurückgeben; deshalb steht sie in SKIP_RESPONSE_HEADERS.
  //
  // Bewusste Abwägung: Die Antwort liegt dabei vollständig im Speicher, bevor sie
  // rausgeht. Für Prozesslisten unkritisch, bei großen GeoJSON-Ergebnissen relevant —
  // der Server ist knapp bei RAM. Falls das je zum Problem wird, muss die Ursache auf
  // Traefik-Seite gesucht werden, statt hier größer zu puffern.
  const upstream = await fetch(target, { method, headers, body })
  const buffer = Buffer.from(await upstream.arrayBuffer())

  setResponseStatus(event, upstream.status, upstream.statusText)
  upstream.headers.forEach((value, key) => {
    if (!SKIP_RESPONSE_HEADERS.has(key.toLowerCase())) {
      setResponseHeader(event, key, value)
    }
  })

  return buffer
})
