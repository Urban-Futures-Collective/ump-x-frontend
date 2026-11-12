// BFF hardening: never send the access or ID token to the browser.
// The 'fetch' and 'refresh' hooks run in the session API routes that deliver the user to
// the client. getUserSession() in the proxy (server/routes/ump) does NOT trigger them, so
// the token stays available on the server but never leaves it.
//
// Before the token is removed, the roles for the client are replaced by those of the
// current token, because the stored session can still hold revoked roles (see
// server/utils/tokenRoles.ts).
interface ClientSession {
  accessToken?: string
  idToken?: string
  claims?: Record<string, unknown>
  userInfo?: Record<string, unknown>
}

function forClient(session: ClientSession | undefined) {
  if (!session || !Object.keys(session).length) return
  session.claims = { ...session.claims, realm_access: undefined, resource_access: undefined, ...tokenClaims(session.accessToken) }
  if (session.userInfo) session.userInfo = { ...session.userInfo, realm_access: undefined, resource_access: undefined }
  delete session.accessToken
  delete session.idToken
}

export default defineNitroPlugin(() => {
  sessionHooks.hook('fetch', session => forClient(session as ClientSession))
  sessionHooks.hook('refresh', session => forClient(session as ClientSession))
})
