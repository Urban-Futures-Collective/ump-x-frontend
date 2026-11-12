// Publishing a model (concept F12, D8). UMP has no write access to Keycloak, so UMP-X
// does both steps: first the status change in UMP with the verifier's own token (UMP
// checks the role and the four-eyes rule again), then the model-access roles in
// Keycloak with the service account.
//
// If the second step fails, the model is published anyway and the response says which
// roles are missing. A reconciler that creates missing roles for all published models
// (F12, `sync-roles`) is still to come; until then an administrator creates them.
import { getUserSession } from 'nuxt-oidc-auth/runtime/server/utils/session.js'

interface UmpModel { provider: string, remote_process_id: string }

export default defineEventHandler(async (event) => {
  await requireRole(event, ROLE_VERIFIER)
  const id = getRouterParam(event, 'id') ?? ''
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    throw createError({ statusCode: 400, statusMessage: 'Unknown model id.' })
  }
  const body = await readBody<{ note?: unknown } | null>(event).catch(() => null)
  const note = typeof body?.note === 'string' && body.note.trim() ? body.note.trim() : undefined

  const session = await getUserSession(event).catch(() => null)
  if (!session?.accessToken) {
    throw createError({ statusCode: 401, statusMessage: 'Anmeldung nötig.' })
  }
  const { umpApiTarget } = useRuntimeConfig(event)

  let model: UmpModel
  try {
    model = await $fetch<UmpModel>(`${umpApiTarget}/registry/v1/models/${id}/transitions`, {
      method: 'POST',
      headers: { authorization: `Bearer ${session.accessToken}` },
      body: { to_status: 'published', ...(note ? { note } : {}) },
    })
  }
  catch (e) {
    // UMP's reason (e.g. not verified yet, own model) goes to the browser as it is.
    const err = e as { statusCode?: number, data?: { detail?: unknown, title?: unknown } }
    const detail = typeof err.data?.detail === 'string' ? err.data.detail : typeof err.data?.title === 'string' ? err.data.title : undefined
    throw createError({ statusCode: err.statusCode ?? 502, statusMessage: detail ?? 'UMP refused to publish the model.' })
  }

  const roles = modelAccessRoleNames(model.provider, model.remote_process_id)
  try {
    await ensureRealmRoles(roles)
    return { published: true, roles, rolesMissing: [] as string[] }
  }
  catch (e) {
    console.error('[publish] model published, but the access roles could not be created', e)
    return { published: true, roles, rolesMissing: roles }
  }
})
