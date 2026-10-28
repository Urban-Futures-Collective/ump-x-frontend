import type { DiscoveredProcess, LangMap, RegistryCardEdit, RegistryModel, RegistryServer, RegistryServerInput, RegistryStatus } from '~/types/registry'
import { ME, sampleDiscovery, sampleModels, sampleServers } from '~/prototype/registrySample'

// The registry on sample data (Contribute, Verify). Everything lives in the browser and
// starts from sample data on each reload; nothing reaches a backend. Same functions as
// useRegistryApi, so the pages work with either (see useRegistry).
export function useRegistryPrototype() {
  const models = useState<RegistryModel[]>('registry-prototype-models', sampleModels)
  const servers = useState<RegistryServer[]>('registry-prototype-servers', sampleServers)
  const { user } = useOidcAuth()
  const { t } = useI18n()
  const myName = computed(() => String(user.value?.userName ?? '') || t('registry.me'))
  const mySub = computed(() => ME)

  function byId(id: string) {
    return models.value.find(m => m.id === id)
  }

  async function transition(id: string, to: RegistryStatus, note?: string) {
    const m = byId(id)
    if (!m) return
    const now = new Date().toISOString()
    m.status = to
    m.statusChangedAt = now
    m.statusNote = note || undefined
    if (to === 'verified') m.verifiedByName = myName.value
    if (to === 'published' && !m.publishedAt) m.publishedAt = now
    m.history.push({ at: now, actorName: myName.value, to, note })
  }

  async function updateCard(id: string, card: RegistryCardEdit) {
    const m = byId(id)
    if (m) Object.assign(m, card)
  }

  async function addServer(input: RegistryServerInput): Promise<RegistryServer> {
    const existing = servers.value.find(s => s.name === input.name && s.ownerSub === ME)
    if (existing) return existing
    const s = { id: `s${Date.now()}`, name: input.name, baseUrl: input.baseUrl, authType: input.authType, hasCredentials: input.authType !== 'NoAuth' && !!input.secret, ownerSub: ME }
    servers.value.push(s)
    return s
  }

  // The prototype answers with sample processes after a short pause, whatever the
  // server. Processes already taken over from it are marked, as the API does.
  async function discover(server: RegistryServer): Promise<DiscoveredProcess[]> {
    await new Promise(r => setTimeout(r, 600))
    return sampleDiscovery().map(p => ({
      ...p,
      modelId: models.value.find(m => m.serverName === server.name && m.remoteProcessId === p.id)?.id,
    }))
  }

  async function addModels(server: RegistryServer, processes: DiscoveredProcess[]): Promise<string[]> {
    const now = new Date().toISOString()
    const created = processes.map((p, i) => {
      const fullName: LangMap = { en: p.title || p.id }
      const m: RegistryModel = {
        id: `m${Date.now()}-${i}`,
        serverName: server.name,
        remoteProcessId: p.id,
        ownerSub: ME,
        ownerName: '',
        defaultLang: 'en',
        fullName,
        shortDescription: p.description ? { en: p.description } : {},
        purpose: {},
        limitationsRisks: {},
        keywords: [],
        versionLabel: p.version ?? '',
        repositoryUrl: '',
        license: '',
        status: 'draft',
        statusChangedAt: now,
        createdAt: now,
        interfaceState: 'unchecked',
        inputs: [],
        history: [],
        contributors: [],
        literature: [],
        requirements: {},
        testCases: [],
      }
      return m
    })
    models.value.push(...created)
    return created.map(m => m.id)
  }

  async function load() {}

  function reset() {
    models.value = sampleModels()
    servers.value = sampleServers()
  }

  return {
    models,
    servers,
    mySub,
    myName,
    loading: ref(false),
    error: ref<string | null>(null),
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

/** Text in the requested language, falling back to the model's default language. */
export function inLang(map: LangMap, lang: string, fallback: 'de' | 'en'): string {
  return map[lang as 'de' | 'en'] || map[fallback] || ''
}
