import type { Process } from '~/types/ump'

// Rohe OGC-API-Processes-Antwort (nur was wir mappen). Ab UMP 3.x sind title und
// description ausdrücklich nullable, id und version sind Pflicht.
interface OgcProcessSummary {
  id: string
  title?: string | null
  description?: string | null
  version?: string
  keywords?: string[] | null
}
interface OgcProcessList {
  processes?: OgcProcessSummary[]
}

// Holt die Prozessliste über den Proxy (/ump/v1.0/processes) und mappt OGC → Process.
// Ohne abschließenden Schrägstrich: UMP 3.x läuft mit redirect_slashes=False, die
// Variante mit Schrägstrich ist dort schlicht eine 404 (bis 2.x war sie Pflicht).
// Welche Prozesse zurückkommen, entscheidet die API anhand des Tokens, den der Proxy
// anhängt — anonym sind es die als anonymous-access markierten.
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
