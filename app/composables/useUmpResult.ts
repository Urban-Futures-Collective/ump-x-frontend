import type { FeatureCollection } from 'geojson'
import type { ResultLayer } from '~/types/ump'

// NAHT 2 (die wichtige): „Job-Ergebnis → kartenfertiges Layer" in genau einem Modul.
// Hier landet später die Umstellung, falls Ergebnisse als OGC API Features oder WFS/WMS
// statt inline-GeoJSON kommen (siehe docs/frontend-backend-architecture.md).
export function useUmpResult() {
  const { base } = useUmpBase()

  async function fetchResult(jobId: string, processId: string): Promise<ResultLayer> {
    const fc = await $fetch<FeatureCollection>(`${base}/jobs/${jobId}/results`, {
      query: { f: 'json' },
    })
    return { jobId, processId, featureCollection: fc }
  }

  return { fetchResult }
}
