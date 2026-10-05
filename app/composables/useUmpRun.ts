import type { ResultLayer, JobStatus  } from '~/types/ump'

// Polling has no time limit: some models (e.g. preparing a city) run for many minutes,
// and the job keeps running on the server whatever the form does. The interval grows
// so a long run does not cost a request per second.
const POLL_FIRST_MS = 1000
const POLL_MAX_MS = 10_000
const POLL_GROWTH = 1.5
// After this, the form says the run takes longer and the page can be left.
const SLOW_AFTER_MS = 60_000

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
  const slow = ref(false)

  // Each run gets a number; a loop whose number is no longer current stops. That ends
  // polling when the form starts a new run or the component goes away.
  let current = 0
  onScopeDispose(() => { current++ })

  async function run(processId: string, inputs: Record<string, unknown>) {
    const self = ++current
    slow.value = false
    error.value = null
    result.value = null
    jobId.value = null
    progress.value = 0
    status.value = 'running'
    try {
      const id = await execute(processId, inputs)
      jobId.value = id
      const started = Date.now()
      let interval = POLL_FIRST_MS
      while (self === current) {
        const job = await getJob(id)
        if (self !== current) return
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
        slow.value = Date.now() - started > SLOW_AFTER_MS
        await new Promise(resolve => setTimeout(resolve, interval))
        interval = Math.min(POLL_MAX_MS, interval * POLL_GROWTH)
      }
    }
    catch (e) {
      if (self !== current) return
      status.value = 'failed'
      // Use the reason from the response body if present (see apiError.ts).
      // Otherwise pass the status as a key that the form turns into a sentence;
      // the raw ofetch line `[POST] "...": 500` means nothing to users. Without
      // a status (network error) keep the message itself.
      const httpStatus = apiErrorStatus(e)
      error.value = apiErrorExplanation(e) ?? (httpStatus ? `http.${httpStatus}` : apiErrorMessage(e))
    }
  }

  return { run, jobId, status, progress, error, result, running, slow }
}
