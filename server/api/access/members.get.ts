// Who holds one access role (design A4, right column).
export default defineEventHandler(async (event) => {
  await requireRole(event, ROLE_ACCESS_ADMIN)
  const role = await accessRoleFrom(getQuery(event).role)
  return accessMembers(role)
})
