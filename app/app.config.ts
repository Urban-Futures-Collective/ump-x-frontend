// Farbrollen von Nuxt UI auf die Palette aus dem Logo legen. Die Skalen selbst
// stehen in app/assets/css/main.css (@theme), weil Tailwind v4 Farben über
// CSS-Variablen führt und es keine tailwind.config mehr gibt.
//
// Bewusst nur die Marken-Rollen umgebogen: success und error bleiben grün und
// rot. Eine Fehlermeldung in Hausfarbe wäre hübsch und würde übersehen.
export default defineAppConfig({
  ui: {
    colors: {
      primary: 'ufc-blue',
      secondary: 'ufc-teal',
      warning: 'ufc-gold',
      info: 'ufc-plum',
      neutral: 'ufc-slate',
    },
  },
})
