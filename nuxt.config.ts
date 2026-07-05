// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-06-01',
  devtools: { enabled: true },

  modules: ['@nuxt/ui', '@nuxt/eslint', '@nuxtjs/i18n', 'nuxt-oidc-auth'],

  // Tailwind v4 + Nuxt UI imports leben in dieser Datei (Reihenfolge: tailwindcss vor @nuxt/ui).
  css: ['~/assets/css/main.css'],

  // Backend-Anbindung: server-seitiger Proxy /ump/** → UMP-API. Base zentral, per Env
  // überschreibbar. Der Proxy (server/routes/ump/[...].ts) hängt den Bearer-Token aus der
  // OIDC-Session an. Siehe docs/frontend-backend-architecture.md (die zwei Nähte).
  runtimeConfig: {
    // Ziel des Proxys (server-only). Prod: per NUXT_UMP_API_TARGET überschreiben.
    umpApiTarget: 'http://localhost:5003',
    public: {
      umpBase: '/ump',
      umpApiVersion: '', // vorbereitet für spätere /v1.0-Versionierung
    },
  },

  // Keycloak-Anbindung: OIDC Authorization Code + PKCE, confidential Client, server-side (BFF).
  // Entscheidung: _llm-wiki/decisions/0091-ump-x-keycloak-oidc-auth-code-pkce.md
  // Secrets + baseUrl/clientId/clientSecret kommen aus .env (NUXT_OIDC_*), nie hartkodiert.
  oidc: {
    defaultProvider: 'keycloak',
    providers: {
      keycloak: {
        // via .env: NUXT_OIDC_PROVIDERS_KEYCLOAK_{BASE_URL,CLIENT_ID,CLIENT_SECRET}
        baseUrl: '',
        clientId: '',
        clientSecret: '',
        // Dev-Default; Prod via NUXT_OIDC_PROVIDERS_KEYCLOAK_REDIRECT_URI (siehe .env.example).
        redirectUri: 'http://localhost:3000/auth/keycloak/callback',
        scope: ['openid', 'profile', 'email'],
        // Access-Token serverseitig verfügbar machen (für den Proxy). Der Client bekommt ihn
        // NICHT — server/plugins/oidc-strip-token.ts entfernt ihn aus der Client-Session.
        exposeAccessToken: true,
        // Keycloak-Access-Token hat aud=account; die UMP-API validiert selbst → hier aus.
        validateAccessToken: false,
        // Dev-Default; Prod via NUXT_OIDC_PROVIDERS_KEYCLOAK_LOGOUT_REDIRECT_URI (siehe .env.example).
        logoutRedirectUri: 'http://localhost:3000',
      },
    },
    // Kein Login-Zwang: anonymer Read-Modus (anonymous-access-Prozesse) bleibt möglich.
    middleware: {
      globalMiddlewareEnabled: false,
    },
    session: {
      automaticRefresh: true,
      expirationCheck: true,
    },
  },

  i18n: {
    defaultLocale: 'de',
    // Single-View-Shell ohne pages/-Routing → Cookie-basiert (no_prefix). Sobald
    // echtes File-based Routing dazukommt, auf 'prefix_except_default' umstellbar.
    strategy: 'no_prefix',
    langDir: 'locales',
    locales: [
      { code: 'de', name: 'Deutsch', language: 'de-DE', file: 'de.json' },
      { code: 'en', name: 'English', language: 'en-US', file: 'en.json' },
    ],
  },
})
