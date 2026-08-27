import type { FeatureCollection } from 'geojson'
import type { Job } from '~/types/ump'

// Einzelner Lauf inklusive Ergebnis. Gegenstück zu useUmpRun: dort wird ein Lauf
// gestartet und live verfolgt, hier wird ein bereits vorhandener nachgeschlagen.
// Die Feldnamen kennt nur toJob (useUmpJobs), das Ergebnis nur useUmpResult.
export function useUmpJob(jobId: MaybeRefOrGetter<string>) {
  const { base } = useUmpBase()
  const { fetchResult } = useUmpResult()

  const id = computed(() => toValue(jobId))

  const { data: job, pending, error, refresh } = useFetch(
    () => `${base}/jobs/${id.value}`,
    { query: { f: 'json' }, transform: (raw: Parameters<typeof toJob>[0]): Job => toJob(raw) },
  )

  const result = ref<FeatureCollection | null>(null)
  const resultPending = ref(false)
  // Getrennt vom Lade-Fehler des Jobs: „Lauf gescheitert" ist etwas anderes als
  // „Lauf nicht gefunden", und die Seite muss beides unterscheiden können.
  const resultError = ref<string | null>(null)

  async function loadResult() {
    if (job.value?.status !== 'successful' || result.value) {
      return
    }
    resultPending.value = true
    resultError.value = null
    try {
      const layer = await fetchResult(id.value, job.value.processId)
      result.value = layer.featureCollection
    }
    catch (e) {
      resultError.value = e instanceof Error ? e.message : String(e)
    }
    finally {
      resultPending.value = false
    }
  }

  return { job, pending, error, refresh, result, resultPending, resultError, loadResult }
}
