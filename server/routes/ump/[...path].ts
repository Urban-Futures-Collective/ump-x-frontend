// getUserSession wird vom Modul NICHT server-auto-importiert (nur sessionHooks),
// daher expliziter Import aus dem Runtime-Subpfad.
import { getUserSession } from 'nuxt-oidc-auth/runtime/server/utils/session.js'

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
  // getUserSession liefert {} ohne Session; accessToken nur bei exposeAccessToken (server-side).
  const session = await getUserSession(event).catch(() => null)
  if (session?.accessToken) {
    headers.Authorization = `Bearer ${session.accessToken}`
  }

  return proxyRequest(event, target, { headers })
})
