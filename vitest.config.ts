import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// Deliberately without @nuxt/test-utils: the tests cover pure functions that know
// neither Nuxt nor a browser, and the Nuxt environment would slow every run down a lot
// without adding coverage. Once a composable that needs useRuntimeConfig or useFetch is
// tested, add @nuxt/test-utils and switch to defineVitestConfig; the tests stay the same.
//
// Tests live next to their source, not in a tests/ directory, so a changed function has
// its test in the same folder.
export default defineConfig({
  test: {
    include: ['app/**/*.test.ts', 'server/**/*.test.ts', 'shared/**/*.test.ts'],
    environment: 'node',
  },
  resolve: {
    alias: {
      '~': fileURLToPath(new URL('./app', import.meta.url)),
      '@': fileURLToPath(new URL('./app', import.meta.url)),
    },
  },
})
