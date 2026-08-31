// getUserSession wird vom Modul NICHT server-auto-importiert (nur sessionHooks),
// daher expliziter Import aus dem Runtime-Subpfad.
import { getUserSession } from 'nuxt-oidc-auth/runtime/server/utils/session.js'

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
  const target = `${umpApiTarget}/${path}${url.search}`

  // Host auf das Ziel setzen. proxyRequest reicht sonst den Host der
  // eingehenden Anfrage weiter, und der nginx vor der UMP-API entscheidet
  // anhand des Hosts, wohin sie geht: mit unserem Host landet sie wieder bei
  // uns statt bei der API. Beim Weiterleiten an eine andere Herkunft gehört
  // dort deren eigener Host hin.
  const headers: Record<string, string> = { host: new URL(umpApiTarget).host }
  // getUserSession liefert {} ohne Session; accessToken nur bei exposeAccessToken (server-side).
  const session = await getUserSession(event).catch(() => null)
  if (session?.accessToken) {
    headers.Authorization = `Bearer ${session.accessToken}`
  }

  return proxyRequest(event, target, { headers })
})
