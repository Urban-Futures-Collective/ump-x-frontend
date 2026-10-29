import { isPlatformRole } from '../../shared/utils/roles'

// Model access as the access manager sees it (design A4): which model servers and models
// have access roles, and which roles an access admin may hand out.
//
// The catalogue is read from the realm roles themselves: a model role is
// `{server}:{process}` (created when a model is published, see modelRoles.ts), its server
// role is `{server}`. Nothing else is an access role. That matters because the service
// account can assign any role, including platform and Keycloak roles; only names in this
// catalogue pass.

const SERVER = /^[a-z0-9][a-z0-9-]{1,62}$/
const PROCESS = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/

export interface AccessServer {
  name: string
  /** Whether the realm has the server role `{name}` (granting the whole server). */
  hasRole: boolean
  /** Process ids that have a model role `{name}:{process}`. */
  processes: string[]
}

export function accessCatalog(roleNames: string[]): AccessServer[] {
  const names = new Set(roleNames)
  const servers = new Map<string, string[]>()
  for (const name of roleNames) {
    const i = name.indexOf(':')
    if (i < 0) continue
    const server = name.slice(0, i)
    const process = name.slice(i + 1)
    if (!SERVER.test(server) || !PROCESS.test(process) || isPlatformRole(server)) continue
    servers.set(server, [...(servers.get(server) ?? []), process])
  }
  return [...servers.entries()]
    .map(([name, processes]) => ({ name, hasRole: names.has(name), processes: processes.sort() }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

/** Whether an access admin may grant or revoke this role. */
export function isAccessRole(role: string, catalog: AccessServer[]): boolean {
  const i = role.indexOf(':')
  if (i < 0) return catalog.some(s => s.name === role && s.hasRole)
  const server = catalog.find(s => s.name === role.slice(0, i))
  return !!server?.processes.includes(role.slice(i + 1))
}
