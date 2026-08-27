import type { Job, JobStatus } from '~/types/ump'

// Rohe OGC-Job-Antwort. Feldnamen am echten Lauf abgelesen (2026-08-27),
// siehe sprints/backlog/006-meine-szenarien.md.
interface OgcJob {
  jobID: string
  processID: string
  status: JobStatus
  progress?: number
  message?: string
  created?: string
  finished?: string
}
interface OgcJobList {
  jobs?: OgcJob[]
  total_count?: number
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
  }
}

// Liste der eigenen Läufe. Welche Jobs zurückkommen, entscheidet die API anhand
// des Tokens, den der Proxy anhängt — das Frontend filtert bewusst nicht selbst.
// Trailing-Slash zwingend, sonst antwortet die API mit einem Redirect.
export function useUmpJobs() {
  const { base } = useUmpBase()
  return useFetch<OgcJobList>(`${base}/jobs/`, {
    query: { f: 'json' },
    default: () => [] as Job[],
    transform: (raw): Job[] =>
      (raw?.jobs ?? [])
        .map(toJob)
        // Neueste zuerst. `created` ist verlässlich, `started` nicht (bleibt null).
        .sort((a, b) => (b.created ?? '').localeCompare(a.created ?? '')),
  })
}
