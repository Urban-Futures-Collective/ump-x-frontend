// Pages that are prototypes with sample data (model registry: Contribute, Verify). Only
// reachable when NUXT_PUBLIC_PROTOTYPES=true, so they stay off production until the
// backend exists. Runs after 'auth'; the role check is in each page's middleware list.
export default defineNuxtRouteMiddleware(() => {
  if (useRuntimeConfig().public.prototypes) return
  return navigateTo('/commons')
})
