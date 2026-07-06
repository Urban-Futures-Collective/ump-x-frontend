import type { Process } from '~/types/ump'

// Rohe OGC-API-Processes-Antwort (nur was wir mappen).
interface OgcProcessSummary {
  id: string
  title?: string
  description?: string
  version?: string
  keywords?: string[]
}
interface OgcProcessList {
  processes?: OgcProcessSummary[]
}

// Holt die Prozessliste über den Proxy (/ump/processes/) und mappt OGC → Process.
// Trailing-Slash zwingend (die API antwortet sonst mit 308 auf den Backend-Host).
// ?f=json erzwingt JSON (pygeoapi liefert sonst HTML).
export function useUmpProcesses() {
  const { base } = useUmpBase()
  return useFetch<OgcProcessList>(`${base}/processes/`, {
    query: { f: 'json' },
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
