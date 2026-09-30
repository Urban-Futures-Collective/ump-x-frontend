// BFF hardening: never send the access or ID token to the browser.
// The 'fetch' hook runs in the session API route that delivers the user to the client.
// getUserSession() in the proxy (server/routes/ump) does NOT trigger this hook, so the
// token stays available on the server but never leaves it.
export default defineNitroPlugin(() => {
  sessionHooks.hook('fetch', (session) => {
    delete session.accessToken
    delete session.idToken
  })
})
