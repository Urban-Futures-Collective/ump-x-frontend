import type { Job, JobStatus } from '~/types/ump'

// Rohe OGC-Job-Antwort (JobStatusInfo). Feldnamen am echten Lauf abgelesen
// (2026-08-27), gegen das OpenAPI-Schema von UMP 3.x nachgezogen.
interface OgcJob {
  jobID: string
  processID: string
  status: JobStatus
  progress?: number
  message?: string
  created?: string
  finished?: string
  updated?: string
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
    processId: r.processID,
    status: r.status,
    progress: r.progress ?? 0,
    message: r.message,
    created: r.created,
    finished: r.finished,
    updated: r.updated,
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
