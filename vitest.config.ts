import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// Bewusst ohne @nuxt/test-utils. Was hier heute getestet wird, sind reine
// Funktionen aus app/utils: sie kennen weder Nuxt noch einen Browser, und die
// Nuxt-Umgebung würde jeden Lauf um ein Vielfaches verlangsamen, ohne etwas
// abzudecken. Sobald ein Composable getestet wird, das useRuntimeConfig oder
// useFetch braucht, kommt @nuxt/test-utils dazu und diese Datei wird zu
// defineVitestConfig; die Tests selbst bleiben davon unberührt.
//
// Tests liegen laut .agents/AGENTS.md neben der Quelle, nicht in einem
// tests/-Verzeichnis: wer eine Funktion ändert, sieht ihren Test im selben Ordner.
export default defineConfig({
  test: {
    include: ['app/**/*.test.ts', 'server/**/*.test.ts'],
    environment: 'node',
  },
  resolve: {
    alias: {
      '~': fileURLToPath(new URL('./app', import.meta.url)),
      '@': fileURLToPath(new URL('./app', import.meta.url)),
    },
  },
})
