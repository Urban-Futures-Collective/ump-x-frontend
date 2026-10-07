import type { AuthType, LangMap, RegistryModel, RegistryServer, RegistryStatus } from '~/types/registry'
import { ME, sampleDiscovery, sampleModels, sampleServers } from '~/prototype/registrySample'

// State and actions of the registry prototype (Contribute, Verify). Everything lives in
// the browser and starts from sample data on each reload; nothing reaches a backend.
// Once the registry API exists, these functions become calls to /v1.0/registry/... with
// the same shapes (see app/types/registry.ts).
export function useRegistryPrototype() {
  const models = useState<RegistryModel[]>('registry-prototype-models', sampleModels)
  const servers = useState<RegistryServer[]>('registry-prototype-servers', sampleServers)
  const { isProvider, isVerifier, isPlatformAdmin } = useUmpRoles()
  const { user } = useOidcAuth()
  const myName = computed(() => String(user.value?.userName ?? '') || 'ich')

  function actorFor(m: RegistryModel) {
    return { isOwner: m.ownerSub === ME, isProvider: isProvider.value, isVerifier: isVerifier.value, isPlatformAdmin: isPlatformAdmin.value }
  }

  function ownerLabel(m: RegistryModel) {
    return m.ownerSub === ME ? myName.value : m.ownerName
  }

  const myModels = computed(() => models.value.filter(m => m.ownerSub === ME))
  const myServers = computed(() => servers.value.filter(s => s.ownerSub === ME))
  const awaitingReview = computed(() => models.value.filter(m => m.status === 'submitted' && m.ownerSub !== ME))

  function byId(id: string) {
    return models.value.find(m => m.id === id)
  }

  function transition(id: string, to: RegistryStatus, note?: string) {
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

  function updateCard(id: string, card: Partial<Pick<RegistryModel, 'fullName' | 'shortDescription' | 'purpose' | 'limitationsRisks' | 'license' | 'repositoryUrl' | 'versionLabel' | 'defaultLang'>>) {
    const m = byId(id)
    if (m) Object.assign(m, card)
  }

  // Register a server and discover its processes. The prototype answers with sample
  // processes after a short pause, whatever the URL.
  async function discover(_url: string) {
    await new Promise(r => setTimeout(r, 600))
    return sampleDiscovery()
  }

  function addServer(name: string, baseUrl: string, authType: AuthType, hasCredentials: boolean): RegistryServer {
    const existing = servers.value.find(s => s.name === name && s.ownerSub === ME)
    if (existing) return existing
    const s = { id: `s${Date.now()}`, name, baseUrl, authType, hasCredentials, ownerSub: ME }
    servers.value.push(s)
    return s
  }

  function addModels(server: RegistryServer, processes: { id: string, title: string, description: string }[]): string[] {
    const now = new Date().toISOString()
    const created = processes.map((p, i) => {
      const fullName: LangMap = { en: p.title }
      const m: RegistryModel = {
        id: `m${Date.now()}-${i}`,
        serverName: server.name,
        remoteProcessId: p.id,
        ownerSub: ME,
        ownerName: '',
        defaultLang: 'en',
        fullName,
        shortDescription: { en: p.description },
        purpose: {},
        limitationsRisks: {},
        keywords: [],
        versionLabel: '1.0',
        repositoryUrl: '',
        license: '',
        status: 'draft',
        statusChangedAt: now,
        createdAt: now,
        interfaceState: 'unchecked',
        inputs: [],
        history: [],
      }
      return m
    })
    models.value.push(...created)
    return created.map(m => m.id)
  }

  function reset() {
    models.value = sampleModels()
    servers.value = sampleServers()
  }

  return { models, myModels, myServers, awaitingReview, byId, actorFor, ownerLabel, transition, updateCard, discover, addServer, addModels, reset }
}

/** Text in the requested language, falling back to the model's default language. */
export function inLang(map: LangMap, lang: string, fallback: 'de' | 'en'): string {
  return map[lang as 'de' | 'en'] || map[fallback] || ''
}
