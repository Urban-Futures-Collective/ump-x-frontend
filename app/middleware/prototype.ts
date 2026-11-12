// The model registry pages (Contribute, Verify). Only reachable with sample data
// (NUXT_PUBLIC_PROTOTYPES=true) or the registry API (NUXT_PUBLIC_REGISTRY_API=true), so
// they stay off production until the backend is there. Runs after 'auth'; the role
// check is in each page's middleware list.
export default defineNuxtRouteMiddleware(() => {
  const { prototypes, registryApi } = useRuntimeConfig().public
  if (prototypes || registryApi) return
  return navigateTo('/commons')
})
