import type { RegistryModel, RegistryServer, RegistryStatus } from '~/types/registry'

// Deleting a model server (UMP DELETE /registry/v1/servers/{id}, decision D17): only
// while every model of the server is in one of these statuses; the models go with it.
export const SERVER_DELETABLE_STATUSES: readonly RegistryStatus[] = ['draft', 'deactivated', 'rejected']

export function modelsOfServer(server: Pick<RegistryServer, 'name'>, models: RegistryModel[]): RegistryModel[] {
  return models.filter(m => m.serverName === server.name)
}

export function blockingModels(models: RegistryModel[]): RegistryModel[] {
  return models.filter(m => !SERVER_DELETABLE_STATUSES.includes(m.status))
}

// "3 published · 1 draft", most frequent first.
export function statusCounts(models: RegistryModel[]): { status: RegistryStatus, n: number }[] {
  const counts = new Map<RegistryStatus, number>()
  for (const m of models) counts.set(m.status, (counts.get(m.status) ?? 0) + 1)
  return [...counts].map(([status, n]) => ({ status, n })).sort((a, b) => b.n - a.n)
}

// Two registrations of the same server rarely differ in more than case, a trailing slash
// or a default port, so those are ignored when looking for duplicates.
export function normalizeBaseUrl(url: string): string {
  try {
    const u = new URL(url.trim())
    const port = (u.protocol === 'https:' && u.port === '443') || (u.protocol === 'http:' && u.port === '80') ? '' : u.port
    const path = u.pathname.replace(/\/+$/, '')
    return `${u.protocol}//${u.hostname.toLowerCase()}${port ? `:${port}` : ''}${path}/`
  }
  catch {
    return url.trim().toLowerCase().replace(/\/+$/, '/')
  }
}

export interface ServerGroup<S> {
  /** Normalised base URL; empty for the group of servers without a duplicate. */
  baseUrl: string
  servers: S[]
}

// Servers that share a base URL first (possible duplicates), each group by name; then
// the rest in one group.
export function groupByBaseUrl<S extends Pick<RegistryServer, 'name' | 'baseUrl'>>(servers: S[]): ServerGroup<S>[] {
  const byUrl = new Map<string, S[]>()
  for (const s of servers) {
    const key = normalizeBaseUrl(s.baseUrl)
    byUrl.set(key, [...(byUrl.get(key) ?? []), s])
  }
  const byName = (a: S, b: S) => a.name.localeCompare(b.name)
  const duplicates = [...byUrl].filter(([, list]) => list.length > 1)
    .map(([baseUrl, list]) => ({ baseUrl, servers: list.sort(byName) }))
    .sort((a, b) => a.baseUrl.localeCompare(b.baseUrl))
  const rest = [...byUrl].filter(([, list]) => list.length === 1).map(([, list]) => list[0]!).sort(byName)
  return rest.length ? [...duplicates, { baseUrl: '', servers: rest }] : duplicates
}

// UMP names the blocking models in the 409 detail: "…; blocking: slug (status), …".
export function blockingFromDetail(detail: string): { slug: string, status: string }[] {
  const list = detail.split(/blocking:\s*/i)[1]
  if (!list) return []
  return [...list.matchAll(/([\w.-]+)\s*\(([\w-]+)\)/g)].map(m => ({ slug: m[1]!, status: m[2]! }))
}
