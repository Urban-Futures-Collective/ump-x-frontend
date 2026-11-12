// Send the invitation email again, e.g. when it did not arrive or the link expired.
// Platform admins only.
export default defineEventHandler(async (event) => {
  const caller = await requireRole(event, ROLE_PLATFORM_ADMIN)
  const id = userIdFrom(event)
  try {
    await sendInvitation(id)
  }
  catch {
    throw createError({ statusCode: 502, statusMessage: 'Die Einladung konnte nicht gesendet werden.' })
  }
  console.info(`[admin] ${caller.sub} lädt ${id} erneut ein`)
  return { ok: true }
})
