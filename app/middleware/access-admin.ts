// The access manager needs the access-admin role (from the token, see useUmpRoles). The
// data is protected server-side in every route under server/api/access/.
export default defineNuxtRouteMiddleware(() => {
  if (useUmpRoles().isAccessAdmin.value) return
  return navigateTo('/commons')
})
