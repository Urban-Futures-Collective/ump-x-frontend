// Contributing models needs the provider role (from the token, see useUmpRoles).
export default defineNuxtRouteMiddleware(() => {
  if (useUmpRoles().isProvider.value) return
  return navigateTo('/commons')
})
