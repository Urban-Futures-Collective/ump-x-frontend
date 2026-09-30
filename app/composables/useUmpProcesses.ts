import type { Process } from '~/types/ump'

// Raw OGC API Processes response (only the mapped fields). In UMP 3.x title and
// description are nullable; id and version are required.
export interface OgcProcessSummary {
  id: string
  title?: string | null
  description?: string | null
  version?: string
  keywords?: string[] | null
}
export interface OgcProcessList {
  processes?: OgcProcessSummary[]
}

// Fetches the process list via the proxy (/ump/v1.0/processes) and maps OGC to
// Process. No trailing slash: UMP 3.x runs with redirect_slashes=False, so the
// slash variant returns 404. The API filters processes by the token the proxy
// attaches; anonymous users see only processes marked anonymous-access.
export function useUmpProcesses() {
  const { base } = useUmpBase()
  return useFetch<OgcProcessList>(`${base}/processes`, {
    default: () => [] as Process[],
    transform: (raw): Process[] =>
      (raw?.processes ?? []).map(p => ({
        id: p.id,
        title: p.title ?? p.id,
        description: p.description ?? '',
        version: p.version ?? '',
        keywords: p.keywords ?? [],
      })),
  })
}
