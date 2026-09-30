// Serverseitige Prüfung: hat die angemeldete Person eine der verlangten Rollen?
//
// Die Middleware `admin` im Browser blendet nur aus, sie schützt nichts. Schutz gibt
// es allein hier, in jeder Admin-Route vor dem ersten Keycloak-Aufruf. Die Rollen
// kommen aus der serverseitigen Sitzung (verschlüsselt, nicht vom Browser änderbar).
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
