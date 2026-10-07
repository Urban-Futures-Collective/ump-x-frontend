import type { RegistryModel, RegistryServer } from '~/types/registry'

// Sample data for the registry prototype. Not from any backend: the registry API does
// not exist yet. Owner `me` stands for whoever is signed in; other owners are made-up
// roles, not people.
export const ME = 'me'

const at = (d: string) => `${d}T09:00:00Z`

export function sampleServers(): RegistryServer[] {
  return [
    { id: 's1', name: 'bikebox-modelserver', baseUrl: 'https://bikebox.example.org', authType: 'NoAuth', hasCredentials: false, ownerSub: 'provider-b' },
    { id: 's2', name: 'modelserver-1', baseUrl: 'https://models.example.org', authType: 'BasicAuth', hasCredentials: true, ownerSub: 'provider-a' },
    { id: 's3', name: 'umep-modelserver', baseUrl: 'https://umep.example.org', authType: 'BasicAuth', hasCredentials: true, ownerSub: ME },
  ]
}

function model(m: Partial<RegistryModel> & Pick<RegistryModel, 'id' | 'serverName' | 'remoteProcessId' | 'ownerSub' | 'ownerName' | 'fullName' | 'shortDescription' | 'status'>): RegistryModel {
  return {
    defaultLang: 'en',
    purpose: {},
    limitationsRisks: {},
    keywords: [],
    versionLabel: '1.0',
    repositoryUrl: '',
    license: 'MIT',
    statusChangedAt: at('2026-10-01'),
    createdAt: at('2026-09-20'),
    interfaceState: 'unchecked',
    inputs: [],
    history: [],
    ...m,
  }
}

export function sampleModels(): RegistryModel[] {
  return [
    model({
      id: 'm1',
      serverName: 'modelserver-1',
      remoteProcessId: 'abm-test-model',
      ownerSub: 'provider-a',
      ownerName: 'Provider A',
      fullName: { en: 'Agent-based Test Model' },
      shortDescription: { en: 'An exemplary model that creates agents over various districts in Hamburg, which then cycle from various Stadtrad stations to others.' },
      status: 'published',
      publishedAt: at('2026-09-01'),
      verifiedByName: 'Verifier A',
      interfaceState: 'in_sync',
      inputs: [{ name: 'agents', type: 'integer', required: true }, { name: 'district', type: 'string', required: false }],
      history: [
        { at: at('2026-08-20'), actorName: 'Provider A', to: 'submitted' },
        { at: at('2026-08-25'), actorName: 'Verifier A', to: 'in_review' },
        { at: at('2026-08-30'), actorName: 'Verifier A', to: 'verified' },
        { at: at('2026-09-01'), actorName: 'Verifier A', to: 'published' },
      ],
    }),
    model({
      id: 'm2',
      serverName: 'modelserver-1',
      remoteProcessId: 'seir-infection-model',
      ownerSub: 'provider-a',
      ownerName: 'Provider A',
      fullName: { en: 'SEIR Disease Infection Model' },
      shortDescription: { en: 'An SEIR infection model developed by the Vensim community.' },
      status: 'published',
      publishedAt: at('2026-09-03'),
      verifiedByName: 'Verifier A',
      interfaceState: 'drifted',
      inputs: [{ name: 'population', type: 'integer', required: true }, { name: 'r0', type: 'number', required: true }],
      history: [
        { at: at('2026-09-02'), actorName: 'Verifier A', to: 'verified' },
        { at: at('2026-09-03'), actorName: 'Verifier A', to: 'published' },
      ],
    }),
    model({
      id: 'm3',
      serverName: 'bikebox-modelserver',
      remoteProcessId: 'growbike',
      ownerSub: 'provider-b',
      ownerName: 'Provider B',
      fullName: { en: 'growbike' },
      shortDescription: { en: 'Using the growbikenet package to build bicycle networks from scratch.' },
      purpose: { en: 'Explore how a city-wide bicycle network could grow step by step.' },
      license: 'AGPL-3.0-or-later',
      repositoryUrl: 'https://github.com/example/bikebox-modelserver',
      status: 'submitted',
      statusChangedAt: at('2026-10-05'),
      inputs: [{ name: 'place', type: 'string', required: true }, { name: 'existing_network_spacing', type: 'number', required: false }],
      history: [{ at: at('2026-10-05'), actorName: 'Provider B', to: 'submitted' }],
    }),
    model({
      id: 'm4',
      serverName: 'bikebox-modelserver',
      remoteProcessId: 'fixbike',
      ownerSub: 'provider-b',
      ownerName: 'Provider B',
      fullName: { en: 'fixbike' },
      shortDescription: { en: 'Using the fixbikenet package to detect gaps in developed bicycle networks.' },
      license: 'AGPL-3.0-or-later',
      status: 'submitted',
      statusChangedAt: at('2026-10-06'),
      inputs: [{ name: 'place', type: 'string', required: true }],
      history: [{ at: at('2026-10-06'), actorName: 'Provider B', to: 'submitted' }],
    }),
    model({
      id: 'm5',
      serverName: 'umep-modelserver',
      remoteProcessId: 'prepare-city',
      ownerSub: ME,
      ownerName: '',
      fullName: { en: 'Prepare city data', de: 'Stadtdaten vorbereiten' },
      shortDescription: { en: 'Collects the status-quo data of a city from open sources.' },
      status: 'draft',
      statusChangedAt: at('2026-10-06'),
      inputs: [{ name: 'city_id', type: 'string', required: true }, { name: 'area', type: 'object', required: false }],
    }),
    model({
      id: 'm6',
      serverName: 'umep-modelserver',
      remoteProcessId: 'heat-stress',
      ownerSub: ME,
      ownerName: '',
      fullName: { en: 'Heat stress', de: 'Hitzebelastung' },
      shortDescription: { en: 'Thermal comfort (UTCI) for a scenario with new trees or buildings.' },
      purpose: { en: 'Compare heat stress before and after planting trees.' },
      status: 'changes_requested',
      statusNote: 'Please add the limitations: which areas and resolutions are supported?',
      statusChangedAt: at('2026-10-06'),
      inputs: [{ name: 'city', type: 'string', required: true }, { name: 'trees', type: 'object', required: false }],
      history: [
        { at: at('2026-10-02'), actorName: '', to: 'submitted' },
        { at: at('2026-10-04'), actorName: 'Verifier A', to: 'in_review' },
        { at: at('2026-10-06'), actorName: 'Verifier A', to: 'changes_requested', note: 'Please add the limitations: which areas and resolutions are supported?' },
      ],
    }),
  ]
}

// What "discovering" a server returns in the prototype, whatever URL was entered.
export function sampleDiscovery(): { id: string, title: string, description: string }[] {
  return [
    { id: 'noise-map', title: 'Noise map', description: 'Road traffic noise for a district.' },
    { id: 'shade-walk', title: 'Shaded walking routes', description: 'Routes with the most shade at a given time.' },
    { id: 'flood-risk', title: 'Heavy rain flood risk', description: 'Flooded areas after heavy rain.' },
  ]
}
