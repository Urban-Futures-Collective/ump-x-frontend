import type { DiscoveredProcess, RegistryCardEdit, RegistryModel, RegistryServer, RegistryServerInput, RegistryStatus } from '~/types/registry'
import type { ApiDiscoveredProcess, ApiModel, ApiServer } from '~/utils/registryApi'
import { cardPatchBody, credentialsBody, discoveredFromApi, modelFromApi, serverFromApi } from '~/utils/registryApi'

// The registry from UMP (/registry/v1, concept F12), through the /ump proxy, which adds
// the user's token. Same functions as useRegistryPrototype (see useRegistry).
//
// The registry path is not under the OGC version prefix (/v1.0): it is UMP's own API
// with its own version.
export function useRegistryApi() {
  const { umpBase } = useRuntimeConfig().public
  const { loggedIn } = useOidcAuth()
  const base = `${umpBase}/registry/v1`

  const models = useState<RegistryModel[]>('registry-api-models', () => [])
  const servers = useState<RegistryServer[]>('registry-api-servers', () => [])
  const me = useState<{ sub: string, displayName: string } | null>('registry-api-me', () => null)
  const loaded = useState('registry-api-loaded', () => false)
  const loading = useState('registry-api-loading', () => false)
  const error = useState<string | null>('registry-api-error', () => null)

  const mySub = computed(() => me.value?.sub ?? '')
  const myName = computed(() => me.value?.displayName ?? '')

  // Models a page at a time (the API allows at most 200 per page).
  async function fetchModels(): Promise<RegistryModel[]> {
    const all: RegistryModel[] = []
    let cursor: string | null = null
    do {
      const page: { models: ApiModel[], next_cursor: string | null } = await $fetch(`${base}/models`, {
        query: { lang: '*', limit: 200, ...(cursor ? { cursor } : {}) },
      })
      all.push(...page.models.map(modelFromApi))
      cursor = page.next_cursor
    } while (cursor)
    return all
  }

  async function load(force = false) {
    // The registry is only for signed-in users; anonymously /me answers 401.
    if (!loggedIn.value || loading.value || (loaded.value && !force)) return
    loading.value = true
    error.value = null
    try {
      const account = await $fetch<{ sub: string, display_name?: string | null }>(`${base}/me`)
      me.value = { sub: account.sub, displayName: account.display_name ?? '' }
      // Servers are only listed for providers and platform admins; others get 403.
      const [list, serverList] = await Promise.all([
        fetchModels(),
        $fetch<{ servers: ApiServer[] }>(`${base}/servers`).catch(() => ({ servers: [] })),
      ])
      models.value = list
      servers.value = serverList.servers.map(serverFromApi)
      loaded.value = true
    }
    catch (e) {
      error.value = apiErrorMessage(e)
    }
    finally {
      loading.value = false
    }
  }

  function byId(id: string) {
    return models.value.find(m => m.id === id)
  }

  function replace(m: RegistryModel) {
    const i = models.value.findIndex(x => x.id === m.id)
    if (i >= 0) models.value[i] = m
    else models.value.push(m)
  }

  // Reads the model again after a write, in all languages: the write responses
  // carry only the caller's language.
  async function reload(id: string) {
    replace(modelFromApi(await $fetch<ApiModel>(`${base}/models/${id}`, { query: { lang: '*' } })))
  }

  async function transition(id: string, to: RegistryStatus, note?: string, verificationJobId?: string) {
    await $fetch(`${base}/models/${id}/transitions`, {
      method: 'POST',
      body: { to_status: to, ...(note ? { note } : {}), ...(verificationJobId ? { verification_job_id: verificationJobId } : {}) },
    })
    await reload(id)
  }

  // PATCH needs the current ETag (If-Match), so a change made elsewhere in the meantime
  // is refused rather than overwritten.
  async function updateCard(id: string, card: RegistryCardEdit) {
    const current = await $fetch.raw(`${base}/models/${id}`, { query: { lang: '*' } })
    const etag = current.headers.get('etag') ?? '*'
    await $fetch(`${base}/models/${id}`, { method: 'PATCH', headers: { 'If-Match': etag }, body: cardPatchBody(card) })
    await reload(id)
  }

  async function addServer(input: RegistryServerInput): Promise<RegistryServer> {
    const created = await $fetch<ApiServer>(`${base}/servers`, {
      method: 'POST',
      body: {
        name: input.name,
        base_url: input.baseUrl,
        authentication: credentialsBody({ type: input.authType, user: input.user, secret: input.secret, keyName: input.keyName }),
      },
    })
    const server = serverFromApi(created)
    servers.value.push(server)
    return server
  }

  async function discover(server: RegistryServer): Promise<DiscoveredProcess[]> {
    const result = await $fetch<{ processes: ApiDiscoveredProcess[] }>(`${base}/servers/${server.id}/discover`, { method: 'POST' })
    return result.processes.map(discoveredFromApi)
  }

  async function addModels(server: RegistryServer, processes: DiscoveredProcess[]): Promise<string[]> {
    const result = await $fetch<{ created: { id: string }[] }>(`${base}/servers/${server.id}/models`, {
      method: 'POST',
      body: { remote_process_ids: processes.map(p => p.id) },
    })
    await Promise.all(result.created.map(c => reload(c.id)))
    return result.created.map(c => c.id)
  }

  function reset() {
    load(true)
  }

  if (import.meta.client) load()

  return {
    models,
    servers,
    mySub,
    myName,
    loading,
    error,
    load,
    byId,
    transition,
    updateCard,
    addServer,
    discover,
    addModels,
    reset,
  }
}
