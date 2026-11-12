import type { Job, ResultLayer } from '~/types/ump'

interface JobView {
  job: Job
  result: ResultLayer | null
  // Result error kept separate from the load error: "run failed" differs from
  // "run not found", and the page must tell them apart.
  resultError: string | null
}

// A single run including its result. Counterpart to useUmpRun, which starts and
// tracks a run live; this looks up an existing one. Only toJob (useUmpJobs)
// knows the field names, only useUmpResult knows the result.
//
// Job and result are loaded in ONE useAsyncData: as two separate loads the
// second starts before the first has the status, and a watch-based follow-up no
// longer fires after hydration, leaving the map empty.
export function useUmpJob(jobId: MaybeRefOrGetter<string>) {
  const { base } = useUmpBase()
  const { fetchResult } = useUmpResult()
  // See useUmpResult: cookies must be forwarded during SSR.
  const request = useRequestFetch()

  const id = computed(() => toValue(jobId))

  const { data, pending, error, refresh } = useAsyncData<JobView>(
    () => `ump-job-${id.value}`,
    async () => {
      const job = toJob(await request<OgcJob>(`${base}/jobs/${id.value}`))
      // For a failed run /results answers 404 "Job failed", so do not ask.
      if (job.status !== 'successful') {
        return { job, result: null, resultError: null }
      }
      try {
        const layer = await fetchResult(id.value, job.processId)
        return { job, result: layer, resultError: null }
      }
      catch (e) {
        // Results of older runs can be gone even though the run succeeded (e.g.
        // the model server was reset). The run itself stays viewable.
        return { job, result: null, resultError: apiErrorMessage(e) }
      }
    },
    { watch: [id] },
  )

  const job = computed(() => data.value?.job ?? null)
  const result = computed(() => data.value?.result ?? null)
  const resultError = computed(() => data.value?.resultError ?? null)

  return { job, result, resultError, pending, error, refresh }
}
