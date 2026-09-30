// Validate admin route path parameters before they end up in a Keycloak admin URL.
import type { H3Event } from 'h3'

// Keycloak user IDs are UUIDs. Anything else is rejected so the parameter cannot address
// another path of the admin API (e.g. "../clients").
export function nutzerIdAus(event: H3Event): string {
  const id = getRouterParam(event, 'id') ?? ''
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    throw createError({ statusCode: 400, statusMessage: 'Ungültige Nutzer-ID.' })
  }
  return id
}

// The role from the request body, accepted only from the allowlist of the six platform
// roles. The service account could assign any role, including realm-admin; anything not
// on the list is rejected here.
export async function plattformRolleAus(event: H3Event): Promise<PlatformRole> {
  const body = await readBody<{ role?: unknown }>(event).catch(() => null)
  if (!isPlatformRole(body?.role)) {
    throw createError({ statusCode: 400, statusMessage: 'Diese Rolle lässt sich hier nicht vergeben.' })
  }
  return body.role
}
