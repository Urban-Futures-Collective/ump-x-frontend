// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  // The package declares `"type": "commonjs"` but ships ESM source with `main` pointing
  // at `src/`. Without transpile, Vite treats it as CJS and misses the default export;
  // dayjs fails the same way without the optimizeDeps entry.
  build: { transpile: ['@masterportal/masterportalapi'] },
  vite: { optimizeDeps: { include: ['dayjs'] } },
  compatibilityDate: '2025-06-01',
  // Keep old bookmarks and shared links to /models working: the catalog lives at /commons.
  routeRules: { '/models': { redirect: { to: '/commons', statusCode: 301 } } },
  devtools: { enabled: true },

  modules: ['@nuxt/ui', '@nuxt/eslint', '@nuxtjs/i18n', 'nuxt-oidc-auth'],

  // Tailwind v4 and Nuxt UI imports live in this file (tailwindcss before @nuxt/ui).
  css: ['~/assets/css/main.css'],

  // Favicon from the same logo file. SVG first, PNG as fallback for browsers without SVG
  // favicons and as the iOS home screen icon.
  app: {
    head: {
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
        { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/favicon-32.png' },
        { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
      ],
    },
  },

  // Light mode only for now; without this the page would follow the visitor's system
  // setting and appear dark for some.
  //
  // The custom storageKey is intentional: a stored preference beats the default, and
  // under a fresh key no earlier 'dark' choice is stored, so 'light' applies.
  colorMode: {
    preference: 'light',
    fallback: 'light',
    storageKey: 'ump-x-color-mode',
  },

  // Backend connection: server-side proxy /ump/** -> UMP API, target configurable via env.
  // The proxy (server/routes/ump/[...path].ts) adds the bearer token from the OIDC session.
  // See docs/frontend-backend-architecture-de.md (the two seams).
  runtimeConfig: {
    // Proxy target (server-only). Override with NUXT_UMP_API_TARGET.
    umpApiTarget: 'http://localhost:5003',
    // Service account for the Keycloak Admin API (role management). Server-only, never
    // public: whoever holds the secret can administer the realm. Set via
    // NUXT_KEYCLOAK_ADMIN_CLIENT_ID / NUXT_KEYCLOAK_ADMIN_CLIENT_SECRET. When empty, the
    // admin routes answer 503 "not configured".
    keycloakAdminClientId: '',
    keycloakAdminClientSecret: '',
    public: {
      umpBase: '/ump',
      mcpUrl: 'https://mcp.urbanfuturescollective.org/mcp',
      accountUrl: 'https://auth.urbanfuturescollective.org/realms/UrbanModelPlatform/account',
      // UMP mounts the OGC routes under a version prefix (/v1.0/processes ...); without
      // it the API answers 404.
      umpApiVersion: 'v1.0',
    },
  },

  // Keycloak: OIDC authorization code + PKCE, confidential client, server-side (BFF).
  // baseUrl, clientId and clientSecret come from .env (NUXT_OIDC_*), never hardcoded.
  oidc: {
    defaultProvider: 'keycloak',
    providers: {
      keycloak: {
        // Via .env: NUXT_OIDC_PROVIDERS_KEYCLOAK_{BASE_URL,CLIENT_ID,CLIENT_SECRET}
        baseUrl: '',
        clientId: '',
        clientSecret: '',
        // Dev default; in production set NUXT_OIDC_PROVIDERS_KEYCLOAK_REDIRECT_URI (see .env.example).
        redirectUri: 'http://localhost:3000/auth/keycloak/callback',
        scope: ['openid', 'profile', 'email'],
        // Access token available server-side (for the proxy). The client never gets it:
        // server/plugins/oidc-strip-token.ts removes it from the client session.
        exposeAccessToken: true,
        // Keycloak access tokens have aud=account; the UMP API validates them itself.
        validateAccessToken: false,
        // Copy roles from the ID token into user.claims (Keycloak's roles mapper stores them
        // as realm_access / resource_access). Without this user.claims stays empty and no
        // roles are seen. useUmpRoles also reads user.userInfo in case the mapper only
        // targets userinfo. See app/composables/useUmpRoles.ts.
        optionalClaims: ['realm_access', 'resource_access'],
        // Dev default; in production set NUXT_OIDC_PROVIDERS_KEYCLOAK_LOGOUT_REDIRECT_URI (see .env.example).
        logoutRedirectUri: 'http://localhost:3000',
      },
    },
    // No forced login: anonymous read access (anonymous-access processes) stays possible.
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
    // File-based routing (pages/), but the locale is cookie-based (no_prefix): keeps route
    // paths clean for middleware/guards and shareable links without a /de or /en prefix.
    // Switch to 'prefix_except_default' if per-locale URLs or SEO are needed.
    strategy: 'no_prefix',
    langDir: 'locales',
    locales: [
      { code: 'de', name: 'Deutsch', language: 'de-DE', file: 'de.json' },
      { code: 'en', name: 'English', language: 'en-US', file: 'en.json' },
    ],
  },
})
