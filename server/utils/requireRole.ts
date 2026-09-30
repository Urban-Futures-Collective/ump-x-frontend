// Server-side check: does the signed-in user have one of the required roles?
//
// The browser-side `admin` middleware only hides UI, it protects nothing. Protection
// happens only here, in every admin route before the first Keycloak call. Roles come from
// the server-side session (encrypted, not modifiable by the browser).
import { getUserSession } from 'nuxt-oidc-auth/runtime/server/utils/session.js'
import type { H3Event } from 'h3'

export interface Aufrufer { sub: string, rollen: string[] }

export async function requireRole(event: H3Event, ...erlaubt: string[]): Promise<Aufrufer> {
  const session = await getUserSession(event).catch(() => null)
  const info = session?.userInfo as { sub?: string } | undefined
  const sub = info?.sub ?? (session?.claims as { sub?: string } | undefined)?.sub
  if (!session || !sub) {
    throw createError({ statusCode: 401, statusMessage: 'Anmeldung nötig.' })
  }
  const rollen = rolesOfSession(session)
  if (!erlaubt.some(r => rollen.includes(r))) {
    throw createError({ statusCode: 403, statusMessage: 'Dafür fehlt die Rolle.' })
  }
  return { sub, rollen }
}
