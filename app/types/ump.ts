import type { FeatureCollection } from 'geojson'
import type { InputGroup } from '~/utils/inputKinds'

// Domain models. Components consume only these, never raw OGC JSON.

export interface Process {
  id: string
  title: string
  description: string
  version: string
  keywords: string[]
}

export interface ProcessInput {
  name: string
  title: string
  description?: string
  type: string
  /** Caller must provide it: minOccurs >= 1 AND no default in the schema. */
  required: boolean
  default?: unknown
  /** The unmodified JSON Schema of the input, including enum/minimum/maximum. */
  schema?: Record<string, unknown>
  /** Display group from `x-ump-group`; main if the model gives none. */
  group: InputGroup
  /** From `x-ump-relevant-if`: only relevant for these values of other inputs. */
  relevantIf?: Record<string, unknown[]>
}

export interface ProcessDetail extends Process {
  inputs: ProcessInput[]
  /** Empty if the process declares no outputs. */
  outputs: ProcessOutput[]
}

export interface ProcessOutput {
  name: string
  title: string
  description?: string
  /**
   * The declared type, as given. UMP is inconsistent: some processes set
   * `format` (e.g. `geojson-feature-collection`), others only
   * `contentMediaType: application/json` even for geodata. Hence both fields,
   * and hence the declaration alone does not decide (see `resultLayers`).
   */
  format?: string
  mediaType?: string
  /** The unmodified JSON Schema of the output. */
  schema?: Record<string, unknown>
}

export type JobStatus = 'accepted' | 'running' | 'successful' | 'failed' | 'dismissed'

export interface Job {
  id: string
  // Optional because the v3 schema marks processID nullable (only jobID and
  // status are required). Display and the retry button check for it.
  processId?: string
  status: JobStatus
  progress: number
  // Optional too: executing a process returns only id/status, the job list
  // returns the full record. See useUmpJobs.
  message?: string
  // ISO timestamps. Only `updated` is reliably set; some UMP instances leave
  // created/started/finished null. Display and sorting fall back to `updated`,
  // see jobTime().
  created?: string
  finished?: string
  updated?: string
}

/** How the map should render a result. */
export interface ResultLayerSpec {
  /** Name of the output the layer comes from. */
  name: string
  kind: 'geojson'
  /** Drives styling. `mixed` if several geometry kinds occur. */
  geometry: 'line' | 'point' | 'polygon' | 'mixed'
  /** Whether the type was declared or detected from the response. */
  source: 'declared' | 'detected'
}

// Output of seam 2: job result -> map-ready layer.
export interface ResultLayer {
  jobId: string
  // Provenance only, not needed to fetch the result, so it may be missing
  // when the job itself has no processID.
  processId?: string
  featureCollection: FeatureCollection
  /** Empty means nothing in this result is mappable. */
  layers: ResultLayerSpec[]
}
