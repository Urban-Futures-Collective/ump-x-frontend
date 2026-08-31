import type { FeatureCollection } from 'geojson'
import type { Job } from '~/types/ump'

interface JobView {
  job: Job
  result: FeatureCollection | null
  // Ergebnis-Fehler getrennt vom Lade-Fehler: „Lauf gescheitert" ist etwas
  // anderes als „Lauf nicht gefunden", und die Seite muss beides unterscheiden.
  resultError: string | null
}

// Einzelner Lauf inklusive Ergebnis. Gegenstück zu useUmpRun: dort wird ein Lauf
// gestartet und live verfolgt, hier wird ein bereits vorhandener nachgeschlagen.
// Die Feldnamen kennt nur toJob (useUmpJobs), das Ergebnis nur useUmpResult.
//
// Job und Ergebnis bewusst in EINEM useAsyncData: Als zwei getrennte Ladevorgänge
// startet der zweite, bevor der erste den Status geliefert hat, und ein Nachziehen
// per watch greift nach der Hydration nicht mehr — die Karte bliebe leer.
export function useUmpJob(jobId: MaybeRefOrGetter<string>) {
  const { base } = useUmpBase()
  const { fetchResult } = useUmpResult()
  // Siehe useUmpResult: beim Server-Rendern müssen die Cookies mitgehen.
  const request = useRequestFetch()

  const id = computed(() => toValue(jobId))

  const { data, pending, error, refresh } = useAsyncData<JobView>(
    () => `ump-job-${id.value}`,
    async () => {
      const job = toJob(await request(`${base}/jobs/${id.value}`))
      // Bei einem gescheiterten Lauf antwortet /results mit 404 „Job failed",
      // deshalb gar nicht erst fragen.
      if (job.status !== 'successful') {
        return { job, result: null, resultError: null }
      }
      try {
        const layer = await fetchResult(id.value, job.processId)
        return { job, result: layer.featureCollection, resultError: null }
      }
      catch (e) {
        // Ergebnisse älterer Läufe können weg sein, obwohl der Lauf erfolgreich
        // war (Modelserver neu aufgesetzt). Der Lauf selbst bleibt anzeigbar.
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
