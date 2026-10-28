// Model registry, as planned for UMP (concept F12: schema `registry` in the UMP database).
// Only the fields the frontend shows; names follow the planned API in camelCase.

/** Text per language, e.g. { de: '…', en: '…' }; the model's default language is required. */
export type LangMap = Partial<Record<'de' | 'en', string>>

export const REGISTRY_STATUSES = [
  'draft',
  'submitted',
  'in_review',
  'changes_requested',
  'rejected',
  'verified',
  'published',
  'deactivated',
] as const
export type RegistryStatus = typeof REGISTRY_STATUSES[number]

export type AuthType = 'NoAuth' | 'BasicAuth' | 'ApiKey' | 'BearerToken'

export interface RegistryServer {
  id: string
  /** Becomes the prefix of the process id, e.g. `bikebox-modelserver`. */
  name: string
  baseUrl: string
  authType: AuthType
  /** Credentials are write-only: the API only says whether some are stored. */
  hasCredentials: boolean
  ownerSub: string
}

export interface RegistryInput {
  name: string
  type: string
  required: boolean
}

/** A process a model server offers, as found when connecting to it. */
export interface DiscoveredProcess {
  id: string
  title?: string
  description?: string
  version?: string
  /** Set when the process is already registered as a model. */
  modelId?: string
}

/** Hardware and runtime a model needs, as the provider states it. */
export interface RegistryRequirements {
  cpuCores?: number
  memoryGb?: number
  runtimeSeconds?: number
}

/** A documented run with known input and expected output, for reviewers to repeat. */
export interface RegistryTestCase {
  name: string
  inputUrl: string
  expectedOutputUrl: string
}

export interface RegistryHistoryEntry {
  at: string
  actorName: string
  to: RegistryStatus
  note?: string
}

export interface RegistryModel {
  id: string
  serverName: string
  remoteProcessId: string
  ownerSub: string
  ownerName: string
  defaultLang: 'de' | 'en'
  fullName: LangMap
  shortDescription: LangMap
  purpose: LangMap
  limitationsRisks: LangMap
  keywords: string[]
  versionLabel: string
  repositoryUrl: string
  /** SPDX identifier, e.g. MIT. */
  license: string
  status: RegistryStatus
  /** Last reviewer comment or reason for rejection or deactivation. */
  statusNote?: string
  statusChangedAt: string
  createdAt: string
  publishedAt?: string
  verifiedByName?: string
  /** Whether the server's process interface still matches the verified one. */
  interfaceState: 'in_sync' | 'drifted' | 'unchecked'
  inputs: RegistryInput[]
  contributors: { name: string, role: string }[]
  literature: { citation: string }[]
  requirements: RegistryRequirements
  testCases: RegistryTestCase[]
  /** Job the reviewer linked when verifying. */
  verificationJobId?: string
  history: RegistryHistoryEntry[]
}

/** Card fields the owner edits on the model page. */
export type RegistryCardEdit = Partial<Pick<RegistryModel, 'fullName' | 'shortDescription' | 'purpose' | 'limitationsRisks' | 'license' | 'repositoryUrl' | 'versionLabel' | 'defaultLang'>>

/** A new model server as entered in the form; the secret is only ever sent, never read back. */
export interface RegistryServerInput {
  name: string
  baseUrl: string
  authType: AuthType
  user?: string
  secret?: string
  /** Header name for an API key. */
  keyName?: string
}
