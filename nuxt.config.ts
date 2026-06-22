// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-06-01',
  devtools: { enabled: true },

  modules: ['@nuxt/ui', '@nuxt/eslint', '@nuxtjs/i18n'],

  // Tailwind v4 + Nuxt UI imports leben in dieser Datei (Reihenfolge: tailwindcss vor @nuxt/ui).
  css: ['~/assets/css/main.css'],

  // Backend-Anbindung (Proxy, runtimeConfig, Composables) folgt in einem eigenen Sprint,
  // sobald Ricos Backend-Vertrag steht. Siehe docs/frontend-backend-architecture.md.

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
