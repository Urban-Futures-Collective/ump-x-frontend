// Pfad-Parameter der Admin-Routen prüfen, bevor sie in eine Keycloak-Adresse wandern.
import type { H3Event } from 'h3'

// Keycloak-Nutzer-IDs sind UUIDs. Alles andere wird abgelehnt, damit niemand über den
// Parameter einen anderen Pfad der Admin-API ansprechen kann (etwa „../clients“).
export function nutzerIdAus(event: H3Event): string {
  const id = getRouterParam(event, 'id') ?? ''
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    throw createError({ statusCode: 400, statusMessage: 'Ungültige Nutzer-ID.' })
  }
  return id
}

// Die Rolle aus dem Rumpf, nur aus der Allowlist der sechs Plattformrollen. Das ist
// die zweite Hälfte der Prüfung aus F11: das Dienstkonto könnte jede Rolle vergeben,
// auch realm-admin; was nicht auf der Liste steht, kommt hier nicht durch.
export async function plattformRolleAus(event: H3Event): Promise<PlatformRole> {
  const body = await readBody<{ role?: unknown }>(event).catch(() => null)
  if (!isPlatformRole(body?.role)) {
    throw createError({ statusCode: 400, statusMessage: 'Diese Rolle lässt sich hier nicht vergeben.' })
  }
  return body.role
}
