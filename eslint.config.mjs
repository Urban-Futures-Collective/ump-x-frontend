// @nuxt/eslint generates the base flat config under .nuxt/.
import withNuxt from './.nuxt/eslint.config.mjs'

// Kilo Code worktrees inside the project folder bring their own eslint.config.mjs,
// which imports a .nuxt/ that does not exist there. Without this ignore, `npm run lint`
// aborts before checking anything.
export default withNuxt({ ignores: ['.kilo/**', '.kilocode/**'] })
