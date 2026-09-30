import type { ResultLayer, JobStatus  } from '~/types/ump'

const POLL_INTERVAL_MS = 1000
const POLL_MAX = 180

// Orchestrates the full flow: execute, poll the job, fetch the result. Reactive
// status for the UI; the result layer comes from the seam (useUmpResult).
export function useUmpRun() {
  const { execute, getJob } = useUmpExecute()
  const { fetchResult } = useUmpResult()

  const status = ref<JobStatus | 'idle'>('idle')
  // Exposed so /run can link to /jobs/{id} after starting.
  const jobId = ref<string | null>(null)
  const progress = ref(0)
  const error = ref<string | null>(null)
  const result = ref<ResultLayer | null>(null)
  const running = computed(() => status.value === 'accepted' || status.value === 'running')

  async function run(processId: string, inputs: Record<string, unknown>) {
    error.value = null
    result.value = null
    jobId.value = null
    progress.value = 0
    status.value = 'running'
    try {
      const id = await execute(processId, inputs)
      jobId.value = id
      for (let i = 0; i < POLL_MAX; i++) {
        const job = await getJob(id)
        status.value = job.status
        progress.value = job.progress
        if (job.status === 'successful') {
          const layer = await fetchResult(id, processId)
          result.value = layer
          return
        }
        if (job.status === 'failed' || job.status === 'dismissed') {
          // The reason is in the job message, e.g. "Upstream Timeout" or the
          // model's error. Only without a message does the status key remain.
          error.value = job.message?.trim() || `job.${job.status}`
          return
        }
        await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS))
      }
      error.value = 'job.timeout'
    }
    catch (e) {
      status.value = 'failed'
      // Use the reason from the response body if present (see apiError.ts).
      // Otherwise pass the status as a key that the form turns into a sentence;
      // the raw ofetch line `[POST] "...": 500` means nothing to users. Without
      // a status (network error) keep the message itself.
      const httpStatus = apiErrorStatus(e)
      error.value = apiErrorExplanation(e) ?? (httpStatus ? `http.${httpStatus}` : apiErrorMessage(e))
    }
  }

  return { run, jobId, status, progress, error, result, running }
}
