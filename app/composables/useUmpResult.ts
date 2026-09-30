import type { FeatureCollection } from 'geojson'
import type { ProcessOutput, ResultLayer } from '~/types/ump'
import { resultLayers } from '~/utils/resultLayers'

// Seam 2: "job result -> map-ready layer", kept in this one module. If results
// are later served as OGC API Features or WFS/WMS instead of inline GeoJSON,
// only this changes (see docs/frontend-backend-architecture-en.md).
export function useUmpResult() {
  const { base } = useUmpBase()
  // useRequestFetch instead of $fetch forwards the incoming request's cookies
  // during SSR. Without them the proxy sees no session, attaches no bearer
  // token, and the API answers "not found". In the browser it equals $fetch.
  const request = useRequestFetch()

  // Outputs come from the process description and are optional: a response
  // that is recognisably geodata still gets a layer (see `resultLayers`).
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
