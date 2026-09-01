// getUserSession wird vom Modul NICHT server-auto-importiert (nur sessionHooks),
// daher expliziter Import aus dem Runtime-Subpfad.
import { getUserSession } from 'nuxt-oidc-auth/runtime/server/utils/session.js'

// Werden 1:1 vom Original-Request übernommen, außer diesen (host/connection sind
// hop-by-hop bzw. request-spezifisch; content-length wird von fetch() neu berechnet).
//
// cookie und authorization sind bewusst dabei: Das nuxt-oidc-auth-Session-Cookie hat
// beim UMP-Backend nichts zu suchen, und NUXT_UMP_API_TARGET zeigt auf eine öffentliche
// Domain, der Request läuft also nach außen. Ein mitgeschicktes authorization würde
// außerdem nur dann überschrieben, wenn zufällig eine Session existiert; den Bearer
// setzen wir unten selbst aus der Session.
//
// Das war kein theoretisches Risiko: h3 lässt cookie in getProxyRequestHeaders stehen
// (ignoriert werden nur transfer-encoding, accept-encoding, connection, keep-alive,
// upgrade, expect, host, accept). Am 2026-08-31 gegen einen mitlaufenden Empfänger
// gemessen, kam das Session-Cookie unverändert beim Ziel an.
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

// Dateiendung aus dem Content-Type der Antwort. Bewusst eine kurze Liste statt einer
// Ableitung aus dem Subtyp: application/geo+json soll .geojson werden und nicht .json.
// Was hier fehlt, bekommt gar keine Endung — lieber ein Name ohne als ein falscher.
const ENDUNGEN: Record<string, string> = {
  'application/geo+json': 'geojson',
  'application/json': 'json',
  'application/gml+xml': 'gml',
  'application/vnd.flatgeobuf': 'fgb',
  'application/x-flatgeobuf': 'fgb',
  'application/zip': 'zip',
  'application/gzip': 'gz',
  'application/pdf': 'pdf',
  'text/csv': 'csv',
  'text/plain': 'txt',
  'image/tiff': 'tif',
  'image/png': 'png',
}

// Der Wunschname kommt vom Aufrufer und landet in einem Antwort-Kopf. Deshalb hart
// filtern: nur Buchstaben, Ziffern, Punkt, Strich und Unterstrich, gedeckelt. Ein
// Zeilenumbruch im Namen wäre eine Header-Injection, ein Anführungszeichen bricht den
// Kopf auf. Was übrig bleibt, ist im Dateisystem überall gültig.
function sauberer(name: string): string {
  return name.replace(/[^A-Za-z0-9._-]/g, '').slice(0, 80)
}

// Authentifizierter Proxy /ump/** → UMP-API. Injiziert den Access-Token aus der
// OIDC-Session als Bearer (nur wenn eingeloggt → anonymer Read-Modus bleibt möglich).
// Dies ist die eine Naht, an der wir später von localhost:5003 auf Ricos Backend
// umstecken (nur NUXT_UMP_API_TARGET tauschen). Siehe docs/frontend-backend-architecture-de.md.
export default defineEventHandler(async (event) => {
  const { umpApiTarget } = useRuntimeConfig(event)

  // Pfad bewusst aus der Anfrage-URL statt über getRouterParam: der
  // Catch-all-Parameter verschluckt einen abschließenden Schrägstrich und
  // verändert damit den Pfad, den die API zu sehen bekommt. Die API nimmt
  // Schrägstriche am Ende genau, seit UMP 3.x (FastAPI mit
  // redirect_slashes=False) sind sie sogar tödlich: /processes/ ist dort eine
  // 404, nicht mehr wie bis 2.x eine 308 auf /processes. Weitergereicht wird
  // deshalb, was hereinkam — die Aufrufer (app/composables/useUmp*) schreiben
  // die Pfade ohne Schrägstrich am Ende.
  const url = getRequestURL(event)
  const path = url.pathname.replace(/^\/ump\/?/, '')

  // `filename` ist unser eigener Parameter und hat beim UMP nichts zu suchen, deshalb
  // hier heraus und nicht mitschicken. Er trägt den Namen ohne Endung; die Endung
  // ergibt sich erst unten aus dem Content-Type der Antwort. Siehe ResultDownload.vue.
  const query = new URLSearchParams(url.search)
  const wunschname = sauberer(query.get('filename') ?? '')
  query.delete('filename')
  const suche = query.toString()
  const target = `${umpApiTarget}/${path}${suche ? `?${suche}` : ''}`

  // Der Host wird hier bewusst NICHT mehr von Hand gesetzt. Nötig war das, solange
  // proxyRequest den Host der eingehenden Anfrage weiterreichte: der nginx vor der
  // UMP-API entscheidet anhand des Hosts, wohin sie geht, und mit unserem Host landete
  // sie wieder bei uns statt bei der API. Mit fetch() erledigt sich das von selbst, weil
  // die Bibliothek den Host aus der Ziel-URL bildet; deshalb steht er in
  // SKIP_REQUEST_HEADERS, damit der eingehende ihn nicht überschreibt.
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

  // Ergebnis-Abrufe als Download benennen. Der Anker im Frontend kann die Endung nicht
  // kennen, er wird geklickt bevor jemand die Antwort gesehen hat; hier ist der
  // Content-Type dagegen da. Rico hat das Durchreichen entschieden, und genau deshalb
  // hängt der Dateiname am Modell und nicht an einer Annahme von uns.
  //
  // Ein vorhandenes Content-Disposition der API gewinnt: sobald UMP selbst eines
  // mitschickt, kann dieser Block ersatzlos weg.
  const eigenes = upstream.headers.get('content-disposition')
  if (!eigenes && upstream.ok && wunschname && path.endsWith('/results')) {
    const typ = (upstream.headers.get('content-type') ?? '').split(';')[0]!.trim().toLowerCase()
    const endung = ENDUNGEN[typ]
    const datei = endung ? `${wunschname}.${endung}` : wunschname
    setResponseHeader(event, 'content-disposition', `attachment; filename="${datei}"`)
  }

  return buffer
})
