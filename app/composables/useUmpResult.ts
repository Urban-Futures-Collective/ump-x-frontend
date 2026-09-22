import type { FeatureCollection } from 'geojson'
import type { ProcessOutput, ResultLayer } from '~/types/ump'
import { resultLayers } from '~/utils/resultLayers'

// NAHT 2 (die wichtige): „Job-Ergebnis → kartenfertiges Layer" in genau einem Modul.
// Hier landet später die Umstellung, falls Ergebnisse als OGC API Features oder WFS/WMS
// statt inline-GeoJSON kommen (siehe docs/frontend-backend-architecture-de.md).
export function useUmpResult() {
  const { base } = useUmpBase()
  // useRequestFetch statt $fetch: beim Server-Rendern werden so die Cookies des
  // eingehenden Requests weitergereicht. Ohne sie sieht der Proxy keine Session,
  // hängt keinen Bearer an, und die API antwortet mit „nicht gefunden".
  // Im Browser ist das identisch zu $fetch.
  const request = useRequestFetch()

  // Die Outputs kommen aus der Prozessbeschreibung und sind optional: wer sie
  // nicht hat, bekommt trotzdem einen Layer, sofern die Antwort erkennbar
  // Geodaten sind. Siehe `resultLayers`.
  async function fetchResult(
    jobId: string,
    processId?: string,
    outputs: ProcessOutput[] = [],
  ): Promise<ResultLayer> {
    const fc = await request<FeatureCollection>(`${base}/jobs/${jobId}/results`)
    return { jobId, processId, featureCollection: fc, layers: resultLayers(outputs, fc) }
  }

  return { fetchResult }
}
