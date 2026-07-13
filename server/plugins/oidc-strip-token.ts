// BFF-Härtung: Access-/ID-Token nie an den Browser geben.
// Der 'fetch'-Hook läuft in der Session-API-Route, die den User an den Client liefert.
// getUserSession() im Proxy (server/routes/ump) triggert diesen Hook NICHT → der Token
// bleibt serverseitig verfügbar, verlässt aber nie den Server.
export default defineNitroPlugin(() => {
  sessionHooks.hook('fetch', (session) => {
    delete session.accessToken
    delete session.idToken
  })
})
