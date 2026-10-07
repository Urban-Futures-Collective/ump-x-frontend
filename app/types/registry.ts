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
  history: RegistryHistoryEntry[]
}
