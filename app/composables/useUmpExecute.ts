import type { Job, JobStatus } from '~/types/ump'

interface ExecuteResponse { jobID: string, status: JobStatus }
interface JobResponse { jobID: string, status: JobStatus, processID: string, progress?: number }

// Execution-Pfad: Prozess ausführen (async) + Job-Status abfragen.
// UMP gibt bei /execution immer { jobID, status } zurück (auch sync); das Ergebnis
// holt man separat über /jobs/{id}/results (siehe useUmpResult).
export function useUmpExecute() {
  const { base } = useUmpBase()

  async function execute(processId: string, inputs: Record<string, unknown>): Promise<string> {
    const res = await $fetch<ExecuteResponse>(`${base}/processes/${processId}/execution`, {
      method: 'POST',
      headers: { Prefer: 'respond-async' },
      body: { inputs },
    })
    return res.jobID
  }

  async function getJob(jobId: string): Promise<Job> {
    const r = await $fetch<JobResponse>(`${base}/jobs/${jobId}`, { query: { f: 'json' } })
    return { id: r.jobID, processId: r.processID, status: r.status, progress: r.progress ?? 0 }
  }

  return { execute, getJob }
}
