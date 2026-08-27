import type { FeatureCollection } from 'geojson'

// Domänenmodelle. Komponenten konsumieren nur diese, nie rohes OGC-JSON.

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
  required: boolean
  default?: unknown
}

export interface ProcessDetail extends Process {
  inputs: ProcessInput[]
}

export type JobStatus = 'accepted' | 'running' | 'successful' | 'failed' | 'dismissed'

export interface Job {
  id: string
  processId: string
  status: JobStatus
  progress: number
  // Ab hier optional: beim Ausführen liefert UMP nur id/status, die Job-Liste
  // dagegen den vollen Satz. Siehe useUmpJobs.
  message?: string
  // ISO-Zeitstempel. `started` liefert die API zwar mit, es blieb im Test aber
  // auch bei gelaufenen Jobs null — deshalb hier bewusst nicht übernommen.
  created?: string
  finished?: string
}

// Ergebnis der „Naht 2": Job-Ergebnis → kartenfertiges Layer.
export interface ResultLayer {
  jobId: string
  processId: string
  featureCollection: FeatureCollection
}
