// nuxt-oidc-auth does not auto-import getUserSession on the server (only sessionHooks),
// so import it from the runtime subpath.
import { getUserSession } from 'nuxt-oidc-auth/runtime/server/utils/session.js'

// Request headers are forwarded as-is except these. host and connection are hop-by-hop
// or request-specific; fetch() recomputes content-length.
//
// cookie and authorization are dropped on purpose: the nuxt-oidc-auth session cookie
// must not reach the UMP backend, and NUXT_UMP_API_TARGET may be a public domain, so the
// request leaves our server. A client-sent authorization header would also only be
// replaced when a session exists; the bearer is set below from the session instead.
// h3's getProxyRequestHeaders keeps cookie, so this filter is required.
const SKIP_REQUEST_HEADERS = new Set([
  'host',
  'connection',
  'content-length',
  'cookie',
  'authorization',
])
// content-length, transfer-encoding and connection are recomputed for the buffered body;
// content-encoding no longer applies because fetch() has already decoded the response.
const SKIP_RESPONSE_HEADERS = new Set(['content-length', 'transfer-encoding', 'connection', 'content-encoding'])

// File extension from the response Content-Type. An explicit short list rather than
// deriving it from the subtype, so application/geo+json becomes .geojson, not .json.
// Unknown types get no extension: better none than a wrong one.
const EXTENSIONS: Record<string, string> = {
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

// The requested name comes from the caller and ends up in a response header, so filter
// strictly: letters, digits, dot, dash and underscore, length-capped. A newline would
// allow header injection, a quote would break the header. The result is a valid file
// name on any file system.
function sanitize(name: string): string {
  return name.replace(/[^A-Za-z0-9._-]/g, '').slice(0, 80)
}

// Authenticated proxy /ump/** -> UMP API. Adds the access token from the OIDC session as
// bearer token, only when logged in, so anonymous read access keeps working.
// This is the single seam for pointing the frontend at a different backend: change
// NUXT_UMP_API_TARGET. See docs/frontend-backend-architecture-de.md.
export default defineEventHandler(async (event) => {
  const { umpApiTarget } = useRuntimeConfig(event)

  // Take the path from the request URL, not getRouterParam: the catch-all parameter
  // drops a trailing slash and so changes the path the API sees. The API is strict about
  // trailing slashes (FastAPI with redirect_slashes=False, /processes/ is a 404), so the
  // path is forwarded exactly as received. Callers (app/composables/useUmp*) write paths
  // without a trailing slash.
  const url = getRequestURL(event)
  const path = url.pathname.replace(/^\/ump\/?/, '')

  // `filename` is our own parameter and is not forwarded to UMP. It holds the name
  // without extension; the extension is derived below from the response Content-Type.
  // See ResultDownload.vue.
  const query = new URLSearchParams(url.search)
  const requestedName = sanitize(query.get('filename') ?? '')
  query.delete('filename')
  const queryString = query.toString()
  const target = `${umpApiTarget}/${path}${queryString ? `?${queryString}` : ''}`

  // Host is not set by hand: fetch() derives it from the target URL. It is listed in
  // SKIP_REQUEST_HEADERS so the incoming Host cannot override it; the reverse proxy in
  // front of the UMP API routes by Host, and our Host would send the request back to us.
  const headers: Record<string, string> = {}
  for (const [key, value] of Object.entries(getRequestHeaders(event))) {
    if (value !== undefined && !SKIP_REQUEST_HEADERS.has(key.toLowerCase())) {
      headers[key] = value
    }
  }
  // getUserSession returns {} without a session; accessToken is only set with
  // exposeAccessToken (server-side only).
  const session = await getUserSession(event).catch(() => null)
  if (session?.accessToken) {
    headers.authorization = `Bearer ${session.accessToken}`
  }

  const method = event.node.req.method ?? 'GET'
  const body = method === 'GET' || method === 'HEAD' ? undefined : await readRawBody(event)

  // Buffered instead of streamed via proxyRequest(): on the deployed instance, streamed
  // (chunked) responses never arrived through the reverse proxy and the request fell
  // through to Nuxt's 404 fallback. Full buffering avoids that. Nitro sets Content-Length
  // itself when a Buffer is returned, hence its entry in SKIP_RESPONSE_HEADERS.
  //
  // Trade-off: the whole response is held in memory before it is sent. Fine for process
  // lists, relevant for large GeoJSON results. If memory becomes a problem, fix the
  // streaming issue at the reverse proxy rather than buffering more here.
  const upstream = await fetch(target, { method, headers, body })
  const buffer = Buffer.from(await upstream.arrayBuffer())

  setResponseStatus(event, upstream.status, upstream.statusText)
  upstream.headers.forEach((value, key) => {
    if (!SKIP_RESPONSE_HEADERS.has(key.toLowerCase())) {
      setResponseHeader(event, key, value)
    }
  })

  // Name result downloads. The frontend link cannot know the extension because it is
  // clicked before the response exists; here the Content-Type is known, so the file name
  // follows what the model actually returns instead of an assumption.
  //
  // A Content-Disposition sent by the API wins; once UMP sends one, this block can go.
  const existingDisposition = upstream.headers.get('content-disposition')
  if (!existingDisposition && upstream.ok && requestedName && path.endsWith('/results')) {
    const contentType = (upstream.headers.get('content-type') ?? '').split(';')[0]!.trim().toLowerCase()
    const extension = EXTENSIONS[contentType]
    const fileName = extension ? `${requestedName}.${extension}` : requestedName
    setResponseHeader(event, 'content-disposition', `attachment; filename="${fileName}"`)
  }

  return buffer
})
