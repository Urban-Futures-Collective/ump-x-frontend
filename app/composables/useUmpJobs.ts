import type { Job, JobStatus } from '~/types/ump'

// Rohe OGC-Job-Antwort (JobStatusInfo). Feldnamen am echten Lauf abgelesen
// (2026-08-27), gegen das OpenAPI-Schema von UMP 3.x nachgezogen: Pflicht sind
// dort ausschließlich jobID und status, alles andere ist ausdrücklich nullable.
// Deshalb hier durchgängig `| null` statt nur `?`, und toJob normalisiert es.
interface OgcJob {
  jobID: string
  processID?: string | null
  status: JobStatus
  progress?: number | null
  message?: string | null
  created?: string | null
  finished?: string | null
  updated?: string | null
}
// UMP 3.x liefert { jobs, links }; das frühere total_count gibt es nicht mehr.
interface OgcJobList {
  jobs?: OgcJob[]
}

// Einzige Stelle, die die Feldnamen der API kennt. Auch von useUmpExecute genutzt,
// damit es nicht zwei Wahrheiten über die Form eines Jobs gibt.
export function toJob(r: OgcJob): Job {
  return {
    id: r.jobID,
    processId: r.processID ?? undefined,
    status: r.status,
    progress: r.progress ?? 0,
    message: r.message ?? undefined,
    created: r.created ?? undefined,
    finished: r.finished ?? undefined,
    updated: r.updated ?? undefined,
  }
}

// Der Zeitpunkt, den ein Lauf in Liste und Sortierung bekommt. `created` wäre die
// richtige Angabe, ist aber nicht überall gefüllt (lokale UMP-Instanz liefert
// created/started/finished durchgängig null); `updated` ist immer da.
export function jobTime(job: Job): string | undefined {
  return job.created ?? job.updated
}

// Liste der eigenen Läufe. Welche Jobs zurückkommen, entscheidet die API anhand
// des Tokens, den der Proxy anhängt — das Frontend filtert bewusst nicht selbst.
// Ohne abschließenden Schrägstrich, siehe useUmpProcesses.
export function useUmpJobs() {
  const { base } = useUmpBase()
  return useFetch<OgcJobList>(`${base}/jobs`, {
    default: () => [] as Job[],
    transform: (raw): Job[] =>
      (raw?.jobs ?? [])
        .map(toJob)
        // Neueste zuerst, über denselben Zeitpunkt, den die Liste auch anzeigt.
        .sort((a, b) => (jobTime(b) ?? '').localeCompare(jobTime(a) ?? '')),
  })
}
