import type { AuthType, DiscoveredProcess, LangMap, RegistryModel, RegistryServer, RegistryStatus } from '~/types/registry'
import { REGISTRY_STATUSES } from '~/types/registry'

// Shapes of the UMP registry API (/registry/v1, concept F12) and their mapping onto
// the frontend types. Only the fields the frontend uses; the API uses snake_case.
// Models are read with ?lang=*, so every text field arrives as a full language map.

export interface ApiReview {
  status_note?: string | null
  status_changed_by?: string | null
  status_changed_at?: string | null
  verified_by?: string | null
  verified_at?: string | null
  verification_job_id?: string | null
}

export interface ApiModel {
  id: string
  provider: string
  remote_process_id: string
  owner_sub: string
  default_lang: string
  full_name: unknown
  short_description?: unknown
  purpose?: unknown
  limitations_risks?: unknown
  keywords?: unknown
  version_label?: string | null
  repository_url?: string | null
  license?: string | null
  status: string
  interface_state: string
  published_at?: string | null
  updated_at?: string | null
  review?: ApiReview | null
  contributors?: { name?: string, role?: string }[]
  literature?: { citation?: string }[]
  requirements?: { cpu_cores?: number | null, memory_gb?: number | null, runtime_seconds?: number | null } | null
  test_cases?: { name?: string, input_url?: string, expected_output_url?: string }[]
}

export interface ApiServer {
  id: string
  name: string
  base_url: string
  owner_sub?: string | null
  auth_type: string
  credentials_set: boolean
}

export interface ApiDiscoveredProcess {
  id: string
  title?: string | null
  description?: string | null
  version?: string | null
  model_id?: string | null
}

const LANGS = ['de', 'en'] as const

/** A language map from the API, reduced to the languages the frontend knows. */
export function langMap(value: unknown): LangMap {
  const map: LangMap = {}
  if (value && typeof value === 'object') {
    for (const lang of LANGS) {
      const text = (value as Record<string, unknown>)[lang]
      if (typeof text === 'string' && text) map[lang] = text
    }
  }
  return map
}

function defaultLang(value: string): 'de' | 'en' {
  return value === 'de' ? 'de' : 'en'
}

function status(value: string): RegistryStatus {
  return (REGISTRY_STATUSES as readonly string[]).includes(value) ? value as RegistryStatus : 'draft'
}

// 'unreachable' is a check that failed, which says no more about the interface than
// no check at all.
function interfaceState(value: string): RegistryModel['interfaceState'] {
  return value === 'in_sync' || value === 'drifted' ? value : 'unchecked'
}

export function modelFromApi(m: ApiModel): RegistryModel {
  const lang = defaultLang(m.default_lang)
  const keywords = m.keywords && typeof m.keywords === 'object'
    ? (m.keywords as Record<string, unknown>)[lang]
    : undefined
  const changedAt = m.review?.status_changed_at ?? m.updated_at ?? ''
  return {
    id: m.id,
    serverName: m.provider,
    remoteProcessId: m.remote_process_id,
    ownerSub: m.owner_sub,
    // The API returns only the owner's id, no name (see ownerLabel).
    ownerName: '',
    defaultLang: lang,
    fullName: langMap(m.full_name),
    shortDescription: langMap(m.short_description),
    purpose: langMap(m.purpose),
    limitationsRisks: langMap(m.limitations_risks),
    keywords: Array.isArray(keywords) ? keywords.filter((k): k is string => typeof k === 'string') : [],
    versionLabel: m.version_label ?? '',
    repositoryUrl: m.repository_url ?? '',
    license: m.license ?? '',
    status: status(m.status),
    statusNote: m.review?.status_note ?? undefined,
    statusChangedAt: changedAt,
    createdAt: m.updated_at ?? changedAt,
    publishedAt: m.published_at ?? undefined,
    verifiedByName: m.review?.verified_by ?? undefined,
    interfaceState: interfaceState(m.interface_state),
    // Inputs come from the process description, history from the audit log
    // (not available yet).
    inputs: [],
    history: [],
    contributors: (m.contributors ?? []).map(c => ({ name: c.name ?? '', role: c.role ?? '' })).filter(c => c.name),
    literature: (m.literature ?? []).map(l => ({ citation: l.citation ?? '' })).filter(l => l.citation),
    requirements: {
      cpuCores: m.requirements?.cpu_cores ?? undefined,
      memoryGb: m.requirements?.memory_gb ?? undefined,
      runtimeSeconds: m.requirements?.runtime_seconds ?? undefined,
    },
    testCases: (m.test_cases ?? [])
      .filter(c => c.name && c.input_url && c.expected_output_url)
      .map(c => ({ name: c.name!, inputUrl: c.input_url!, expectedOutputUrl: c.expected_output_url! })),
    verificationJobId: m.review?.verification_job_id ?? undefined,
  }
}

export function serverFromApi(s: ApiServer): RegistryServer {
  const authType = (['NoAuth', 'BasicAuth', 'ApiKey', 'BearerToken'] as AuthType[]).includes(s.auth_type as AuthType)
    ? s.auth_type as AuthType
    : 'NoAuth'
  return { id: s.id, name: s.name, baseUrl: s.base_url, authType, hasCredentials: s.credentials_set, ownerSub: s.owner_sub ?? '' }
}

export function discoveredFromApi(p: ApiDiscoveredProcess): DiscoveredProcess {
  return {
    id: p.id,
    title: p.title ?? undefined,
    description: p.description ?? undefined,
    version: p.version ?? undefined,
    modelId: p.model_id ?? undefined,
  }
}

export interface Credentials {
  type: AuthType
  user?: string
  secret?: string
  /** Header name for an API key, e.g. X-API-Key. */
  keyName?: string
}

/** The `authentication` field of POST /servers; null means no authentication. */
export function credentialsBody(c: Credentials): Record<string, string> | null {
  switch (c.type) {
    case 'BasicAuth': return { type: 'BasicAuth', user: c.user ?? '', password: c.secret ?? '' }
    case 'ApiKey': return { type: 'ApiKey', key_name: c.keyName ?? '', key_value: c.secret ?? '' }
    case 'BearerToken': return { type: 'BearerToken', token: c.secret ?? '' }
    default: return null
  }
}

/** Card fields as PATCH /models/{id} expects them. Empty texts are left out; a field with no text at all is cleared. */
export function cardPatchBody(card: Partial<Pick<RegistryModel, 'fullName' | 'shortDescription' | 'purpose' | 'limitationsRisks' | 'license' | 'repositoryUrl' | 'versionLabel' | 'defaultLang'>>): Record<string, unknown> {
  const body: Record<string, unknown> = {}
  const maps = { fullName: 'full_name', shortDescription: 'short_description', purpose: 'purpose', limitationsRisks: 'limitations_risks' } as const
  for (const [key, field] of Object.entries(maps)) {
    const map = card[key as keyof typeof maps]
    if (!map) continue
    const filled = Object.fromEntries(Object.entries(map).filter(([, text]) => text?.trim()))
    body[field] = Object.keys(filled).length ? filled : null
  }
  if (card.license !== undefined) body.license = card.license || null
  if (card.repositoryUrl !== undefined) body.repository_url = card.repositoryUrl || null
  if (card.versionLabel !== undefined) body.version_label = card.versionLabel || null
  if (card.defaultLang) body.default_lang = card.defaultLang
  return body
}
