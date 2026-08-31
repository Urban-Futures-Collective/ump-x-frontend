import type { Job } from '~/types/ump'

// Execution-Pfad: Prozess ausführen (async) + Job-Status abfragen.
// UMP 3.x antwortet auf /execution mit 201 und einem vollständigen JobStatusInfo
// (nicht nur { jobID, status }) — derselben Form wie /jobs/{id}. Deshalb wird die
// Antwort durch dasselbe toJob geschickt statt eigens typisiert. Das Ergebnis holt
// man weiterhin separat über /jobs/{id}/results (siehe useUmpResult).
export function useUmpExecute() {
  const { base } = useUmpBase()

  async function execute(processId: string, inputs: Record<string, unknown>): Promise<string> {
    const res = await $fetch(`${base}/processes/${processId}/execution`, {
      method: 'POST',
      headers: { Prefer: 'respond-async' },
      body: { inputs },
    })
    return toJob(res).id
  }

  // Mapping bewusst geliehen statt wiederholt: die Feldnamen der API stehen
  // ausschließlich in useUmpJobs.
  async function getJob(jobId: string): Promise<Job> {
    return toJob(await $fetch(`${base}/jobs/${jobId}`))
  }

  return { execute, getJob }
}
