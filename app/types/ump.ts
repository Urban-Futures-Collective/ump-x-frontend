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
  /** Muss der Aufrufer liefern: minOccurs >= 1 UND keine Vorgabe im Schema. */
  required: boolean
  default?: unknown
  /** Das unveraenderte JSON-Schema der Eingabe, inklusive enum/minimum/maximum. */
  schema?: Record<string, unknown>
}

export interface ProcessDetail extends Process {
  inputs: ProcessInput[]
  /** Leer, wenn der Prozess nichts deklariert. Am 2026-09-22 tun das alle vier. */
  outputs: ProcessOutput[]
}

export interface ProcessOutput {
  name: string
  title: string
  description?: string
  /**
   * Der deklarierte Typ, so wie er dasteht. UMP führt ihn uneinheitlich: die
   * bikebox-Modelle setzen `format: geojson-feature-collection`, die Modelle auf
   * modelserver-1 nur `contentMediaType: application/json`, obwohl einer ihrer
   * Outputs wörtlich `GeoJSON` heißt. Deshalb stehen beide Felder hier, und
   * deshalb entscheidet die Deklaration allein nicht.
   */
  format?: string
  mediaType?: string
  /** Das unveraenderte JSON-Schema des Outputs. */
  schema?: Record<string, unknown>
}

export type JobStatus = 'accepted' | 'running' | 'successful' | 'failed' | 'dismissed'

export interface Job {
  id: string
  // Optional, weil das v3-Schema processID ausdrücklich nullable führt: nur
  // jobID und status sind Pflicht. Anzeige und Wiederholen-Knopf prüfen darauf.
  processId?: string
  status: JobStatus
  progress: number
  // Ebenfalls optional: beim Ausführen liefert UMP nur id/status, die Job-Liste
  // dagegen den vollen Satz. Siehe useUmpJobs.
  message?: string
  // ISO-Zeitstempel. Achtung: nur `updated` ist verlässlich gefüllt. Auf
  // Produktion liefert die API created/finished mit, die lokale Instanz lässt
  // beide (und started) durchgängig null. Anzeige und Sortierung fallen deshalb
  // auf `updated` zurück, siehe jobTime().
  created?: string
  finished?: string
  updated?: string
}

/** Was die Karte aus einem Ergebnis machen soll. */
export interface ResultLayerSpec {
  /** Name des Outputs, aus dem der Layer entsteht. */
  name: string
  kind: 'geojson'
  /** Bestimmt das Styling. `mixed`, wenn mehrere Geometriearten vorkommen. */
  geometry: 'line' | 'point' | 'polygon' | 'mixed'
  /** Woher der Typ kam. Für die Anzeige, wenn nichts darstellbar ist. */
  quelle: 'deklariert' | 'erkannt'
}

// Ergebnis der „Naht 2": Job-Ergebnis → kartenfertiges Layer.
export interface ResultLayer {
  jobId: string
  // Nur Herkunftsangabe, für den Abruf des Ergebnisses wird sie nicht gebraucht.
  // Darf deshalb fehlen, wenn der Job selbst keine processID trägt.
  processId?: string
  featureCollection: FeatureCollection
  /** Leer heißt: nichts an diesem Ergebnis lässt sich auf einer Karte zeigen. */
  layers: ResultLayerSpec[]
}
