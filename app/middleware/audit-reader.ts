// The audit log is for verifiers, access admins and platform admins, as in UMP.
export default defineNuxtRouteMiddleware(() => {
  const { isVerifier, isAdmin } = useUmpRoles()
  if (isVerifier.value || isAdmin.value) return
  return navigateTo('/commons')
})
