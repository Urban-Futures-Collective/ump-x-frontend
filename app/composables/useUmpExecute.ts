import type { Job, JobStatus } from '~/types/ump'

interface ExecuteResponse { jobID: string, status: JobStatus }

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

  // Mapping bewusst geliehen statt wiederholt: die Feldnamen der API stehen
  // ausschließlich in useUmpJobs.
  async function getJob(jobId: string): Promise<Job> {
    return toJob(await $fetch(`${base}/jobs/${jobId}`, { query: { f: 'json' } }))
  }

  return { execute, getJob }
}
