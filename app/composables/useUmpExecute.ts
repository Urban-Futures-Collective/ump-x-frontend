import type { Job } from '~/types/ump'

// Execution path: run a process (async) and query job status.
// UMP 3.x answers /execution with 201 and a full JobStatusInfo (not just
// { jobID, status }), the same shape as /jobs/{id}, so the response goes through
// the same toJob. Results are fetched separately via /jobs/{id}/results
// (see useUmpResult).
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

  // Reuse toJob instead of repeating the mapping: the API field names live only
  // in useUmpJobs.
  async function getJob(jobId: string): Promise<Job> {
    return toJob(await $fetch(`${base}/jobs/${jobId}`))
  }

  return { execute, getJob }
}
