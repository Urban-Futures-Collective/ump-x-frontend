// Reviewing models needs the verifier role (from the token, see useUmpRoles).
export default defineNuxtRouteMiddleware(() => {
  if (useUmpRoles().isVerifier.value) return
  return navigateTo('/commons')
})
