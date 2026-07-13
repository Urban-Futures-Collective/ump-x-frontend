import type { FeatureCollection } from 'geojson'
import type { JobStatus } from '~/types/ump'

const POLL_INTERVAL_MS = 1000
const POLL_MAX = 180

// Orchestriert den vertikalen Durchstich: ausführen → Job pollen → Ergebnis holen.
// Reaktiver Status für die UI; das Ergebnis-Layer kommt aus der Naht (useUmpResult).
export function useUmpRun() {
  const { execute, getJob } = useUmpExecute()
  const { fetchResult } = useUmpResult()

  const status = ref<JobStatus | 'idle'>('idle')
  const progress = ref(0)
  const error = ref<string | null>(null)
  const result = ref<FeatureCollection | null>(null)
  const running = computed(() => status.value === 'accepted' || status.value === 'running')

  async function run(processId: string, inputs: Record<string, unknown>) {
    error.value = null
    result.value = null
    progress.value = 0
    status.value = 'running'
    try {
      const jobId = await execute(processId, inputs)
      for (let i = 0; i < POLL_MAX; i++) {
        const job = await getJob(jobId)
        status.value = job.status
        progress.value = job.progress
        if (job.status === 'successful') {
          const layer = await fetchResult(jobId, processId)
          result.value = layer.featureCollection
          return
        }
        if (job.status === 'failed' || job.status === 'dismissed') {
          error.value = `job.${job.status}`
          return
        }
        await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS))
      }
      error.value = 'job.timeout'
    }
    catch (e) {
      status.value = 'failed'
      error.value = e instanceof Error ? e.message : String(e)
    }
  }

  return { run, status, progress, error, result, running }
}
