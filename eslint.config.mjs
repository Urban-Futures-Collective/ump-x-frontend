// @nuxt/eslint generiert die Basis-Config unter .nuxt/ (flat config).
import withNuxt from './.nuxt/eslint.config.mjs'

// Fremde Worktrees von Kilo Code liegen im Projektordner und bringen eigene
// eslint.config.mjs mit, deren Import auf eine .nuxt/ zeigt, die es dort nicht
// gibt. Ohne den Ausschluss bricht `npm run lint` ab, bevor es etwas prüft.
export default withNuxt({ ignores: ['.kilo/**', '.kilocode/**'] })
