// Map Nuxt UI color roles onto the logo palette. The scales themselves live in
// app/assets/css/main.css (@theme): Tailwind v4 defines colors as CSS variables
// and has no tailwind.config.
//
// Only the brand roles are remapped; success and error stay green and red so
// error messages are not lost in the brand colors.
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
