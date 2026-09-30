import type { Job, JobStatus } from '~/types/ump'

// Raw OGC job response (JobStatusInfo). In the UMP 3.x OpenAPI schema only jobID
// and status are required and everything else is explicitly nullable, hence
// `| null` rather than just `?`; toJob normalises it.
export interface OgcJob {
  jobID: string
  processID?: string | null
  status: JobStatus
  progress?: number | null
  message?: string | null
  created?: string | null
  finished?: string | null
  updated?: string | null
}
// UMP 3.x returns { jobs, links }; there is no total_count.
export interface OgcJobList {
  jobs?: OgcJob[]
}

// The only place that knows the API field names. Also used by useUmpExecute so
// there is a single definition of a job's shape.
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

// The timestamp a run gets in the list and for sorting. `created` would be right
// but is not always filled (some UMP instances return created/started/finished
// as null); `updated` is always present.
export function jobTime(job: Job): string | undefined {
  return job.created ?? job.updated
}

// Newest first, using the same timestamp the list shows. Lives here rather than
// in the query because the chat needs the same order, and two sorts over the
// same data drift apart.
export function newestFirst(jobs: Job[]): Job[] {
  return [...jobs].sort((a, b) => (jobTime(b) ?? '').localeCompare(jobTime(a) ?? ''))
}

// The user's own runs. The API decides which jobs are returned based on the
// token the proxy attaches; the frontend deliberately does not filter.
// No trailing slash, see useUmpProcesses.
export function useUmpJobs() {
  const { base } = useUmpBase()
  return useFetch<OgcJobList>(`${base}/jobs`, {
    default: () => [] as Job[],
    transform: (raw): Job[] => newestFirst((raw?.jobs ?? []).map(toJob)),
  })
}
