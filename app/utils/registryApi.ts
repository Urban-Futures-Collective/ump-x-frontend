import type { AuthType, DiscoveredProcess, LangMap, RegistryCardEdit, RegistryIo, RegistryModel, RegistryServer, RegistryStatus } from '~/types/registry'
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
  owner_display_name?: string | null
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
  anonymous_access?: boolean
  published_at?: string | null
  updated_at?: string | null
  review?: ApiReview | null
  code_ref?: string | null
  contributors?: { name?: string, role?: string, orcid?: string | null, affiliation?: string | null, email?: string | null }[]
  literature?: { citation?: string, doi?: string | null, url?: string | null, year?: number | null }[]
  applications?: { title?: unknown, description?: unknown, location?: string | null, url?: string | null, year?: number | null }[]
  requirements?: {
    cpu_cores?: number | null
    memory_gb?: number | null
    runtime_seconds?: number | null
    storage_gb?: number | null
    gpu?: string | boolean | null
    software?: string[] | null
  } | null
  test_cases?: {
    name?: string
    input_url?: string
    expected_output_url?: string
    description?: unknown
    documentation_url?: string | null
    input_sha256?: string | null
    output_sha256?: string | null
  }[]
  io_notes?: Record<string, unknown> | null
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

/** A per-language list (keywords) from the API, reduced to the languages the frontend knows. */
export function langList(value: unknown): Partial<Record<'de' | 'en', string[]>> {
  const map: Partial<Record<'de' | 'en', string[]>> = {}
  if (value && typeof value === 'object') {
    for (const lang of LANGS) {
      const list = (value as Record<string, unknown>)[lang]
      if (Array.isArray(list)) map[lang] = list.filter((k): k is string => typeof k === 'string' && !!k)
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
  const keywordsByLang = langList(m.keywords)
  const keywords = keywordsByLang[lang] ?? []
  const changedAt = m.review?.status_changed_at ?? m.updated_at ?? ''
  return {
    id: m.id,
    serverName: m.provider,
    remoteProcessId: m.remote_process_id,
    ownerSub: m.owner_sub,
    // Public display name from the owner's account (UMP issue #13); empty until UMP
    // has seen the owner sign in.
    ownerName: m.owner_display_name ?? '',
    defaultLang: lang,
    fullName: langMap(m.full_name),
    shortDescription: langMap(m.short_description),
    purpose: langMap(m.purpose),
    limitationsRisks: langMap(m.limitations_risks),
    keywords,
    keywordsByLang,
    versionLabel: m.version_label ?? '',
    repositoryUrl: m.repository_url ?? '',
    codeRef: m.code_ref ?? '',
    license: m.license ?? '',
    status: status(m.status),
    statusNote: m.review?.status_note ?? undefined,
    statusChangedAt: changedAt,
    createdAt: m.updated_at ?? changedAt,
    publishedAt: m.published_at ?? undefined,
    verifiedByName: m.review?.verified_by ?? undefined,
    interfaceState: interfaceState(m.interface_state),
    anonymousAccess: m.anonymous_access ?? false,
    // Inputs come from the process description, history from the audit log
    // (not available yet).
    inputs: [],
    history: [],
    contributors: (m.contributors ?? [])
      .map(c => ({ name: c.name ?? '', role: c.role ?? '', orcid: c.orcid ?? undefined, affiliation: c.affiliation ?? undefined, email: c.email ?? undefined }))
      .filter(c => c.name),
    literature: (m.literature ?? [])
      .map(l => ({ citation: l.citation ?? '', doi: l.doi ?? undefined, url: l.url ?? undefined, year: l.year ?? undefined }))
      .filter(l => l.citation),
    applications: (m.applications ?? [])
      .map(a => ({ title: langMap(a.title), description: langMap(a.description), location: a.location ?? undefined, url: a.url ?? undefined, year: a.year ?? undefined }))
      .filter(a => Object.keys(a.title).length),
    requirements: {
      cpuCores: m.requirements?.cpu_cores ?? undefined,
      memoryGb: m.requirements?.memory_gb ?? undefined,
      runtimeSeconds: m.requirements?.runtime_seconds ?? undefined,
      storageGb: m.requirements?.storage_gb ?? undefined,
      gpu: m.requirements?.gpu ?? undefined,
      software: m.requirements?.software ?? undefined,
    },
    testCases: (m.test_cases ?? [])
      .filter(c => c.name && c.input_url && c.expected_output_url)
      .map(c => ({
        name: c.name!,
        inputUrl: c.input_url!,
        expectedOutputUrl: c.expected_output_url!,
        description: langMap(c.description),
        documentationUrl: c.documentation_url ?? undefined,
        inputSha256: c.input_sha256 ?? undefined,
        outputSha256: c.output_sha256 ?? undefined,
      })),
    ioNotes: Object.fromEntries(Object.entries(m.io_notes ?? {}).map(([k, v]) => [k, langMap(v)])),
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

/**
 * If-Match value for a PATCH from the ETag of the preceding GET. The nginx in front of UMP
 * compresses responses and so turns the ETag weak (W/"..."), while UMP compares If-Match
 * exactly against the strong form; the W/ prefix is dropped so the comparison can match.
 */
export function ifMatch(etag: string | null): string {
  return (etag ?? '*').replace(/^W\//, '')
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

/** Text per language with empty entries left out; null when nothing is left. */
function filledMap(map: LangMap | undefined): LangMap | null {
  const filled = Object.fromEntries(Object.entries(map ?? {}).filter(([, text]) => text?.trim()))
  return Object.keys(filled).length ? filled : null
}

/** Drops empty strings and undefined so optional fields are not sent as "". */
function compact<T extends Record<string, unknown>>(o: T): Partial<T> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== '')) as Partial<T>
}

/** Card fields as PATCH /models/{id} expects them. Empty texts are left out; a field with no text at all is cleared. */
export function cardPatchBody(card: RegistryCardEdit): Record<string, unknown> {
  const body: Record<string, unknown> = {}
  const maps = { fullName: 'full_name', shortDescription: 'short_description', purpose: 'purpose', limitationsRisks: 'limitations_risks' } as const
  for (const [key, field] of Object.entries(maps)) {
    const map = card[key as keyof typeof maps]
    if (!map) continue
    body[field] = filledMap(map)
  }
  if (card.license !== undefined) body.license = card.license || null
  if (card.repositoryUrl !== undefined) body.repository_url = card.repositoryUrl || null
  if (card.versionLabel !== undefined) body.version_label = card.versionLabel || null
  if (card.codeRef !== undefined) body.code_ref = card.codeRef || null
  if (card.defaultLang) body.default_lang = card.defaultLang
  if (card.keywordsByLang) {
    const lists = Object.fromEntries(Object.entries(card.keywordsByLang).filter(([, l]) => l?.length))
    body.keywords = Object.keys(lists).length ? lists : null
  }
  if (card.contributors) {
    body.contributors = card.contributors.filter(c => c.name.trim())
      .map(c => compact({ name: c.name.trim(), role: c.role, orcid: c.orcid?.trim(), affiliation: c.affiliation?.trim(), email: c.email?.trim() }))
  }
  if (card.literature) {
    body.literature = card.literature.filter(l => l.citation.trim())
      .map(l => compact({ citation: l.citation.trim(), doi: l.doi?.trim(), url: l.url?.trim(), year: l.year || undefined }))
  }
  if (card.applications) {
    body.applications = card.applications.filter(a => filledMap(a.title))
      .map(a => compact({ title: filledMap(a.title), description: filledMap(a.description), location: a.location?.trim(), url: a.url?.trim(), year: a.year || undefined }))
  }
  if (card.requirements) {
    const r = card.requirements
    const req = compact({
      cpu_cores: r.cpuCores,
      memory_gb: r.memoryGb,
      storage_gb: r.storageGb,
      runtime_seconds: r.runtimeSeconds,
      gpu: r.gpu === '' ? undefined : r.gpu,
      software: r.software?.length ? r.software : undefined,
    })
    body.requirements = Object.keys(req).length ? req : null
  }
  if (card.testCases) {
    body.test_cases = card.testCases.filter(c => c.name.trim() && c.inputUrl.trim() && c.expectedOutputUrl.trim())
      .map(c => compact({
        name: c.name.trim(),
        description: filledMap(c.description),
        input_url: c.inputUrl.trim(),
        expected_output_url: c.expectedOutputUrl.trim(),
        documentation_url: c.documentationUrl?.trim(),
        input_sha256: c.inputSha256?.trim().toLowerCase(),
        output_sha256: c.outputSha256?.trim().toLowerCase(),
      }))
  }
  if (card.ioNotes) {
    const notes = Object.entries(card.ioNotes).map(([id, map]) => [id, filledMap(map)] as const).filter(([, m]) => m)
    body.io_notes = Object.fromEntries(notes)
  }
  return body
}

/**
 * Inputs and outputs from an OGC process description (GET /models/{id}/interface), with a
 * short type line for the notes section.
 */
export function ioFromDescription(description: unknown): RegistryIo[] {
  const d = (description ?? {}) as { inputs?: Record<string, { schema?: Record<string, unknown> }>, outputs?: Record<string, { schema?: Record<string, unknown> }> }
  const typeOf = (schema: Record<string, unknown> | undefined): string => {
    if (!schema) return ''
    if (Array.isArray(schema.enum)) return `enum: ${schema.enum.join(', ')}`
    const range = schema.minimum !== undefined && schema.maximum !== undefined ? `, ${schema.minimum}–${schema.maximum}` : ''
    if (typeof schema.type === 'string') return `${schema.type}${range}`
    if (typeof schema.format === 'string') return schema.format
    if (Array.isArray(schema.oneOf) || Array.isArray(schema.anyOf)) return 'object'
    return ''
  }
  return [
    ...Object.entries(d.inputs ?? {}).map(([id, i]) => ({ id, kind: 'input' as const, type: typeOf(i.schema) })),
    ...Object.entries(d.outputs ?? {}).map(([id, o]) => ({ id, kind: 'output' as const, type: typeOf(o.schema) })),
  ]
}
