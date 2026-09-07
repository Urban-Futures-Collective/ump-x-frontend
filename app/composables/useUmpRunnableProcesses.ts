// Welche Prozesse darf der aktuelle Aufrufer ausführen?
//
// Die Prozessliste beantwortet das nicht: seit `UMP_PUBLIC_PROCESSES` wieder an
// ist, zeigt sie jedem alles. Der MCP-Werkzeugkatalog filtert dagegen nach genau
// der Regel, die auch beim Ausführen gilt, und trägt damit die Auskunft, die wir
// brauchen, um ein gesperrtes Modell vorher zu kennzeichnen statt erst beim Klick
// auf Ausführen. Am 2026-08-31 gemessen: /v1.0/processes gibt vier Modelle
// zurück, /mcp/v1/tools eines.
//
// Hieß bis 2026-09-04 useUmpOpenProcesses. Der Name stimmte nur, solange die
// Liste ohnehin gefiltert war; „offen" heißt hier nicht „ohne Anmeldung",
// sondern „von dir ausführbar" — angemeldet kommen die Rollen dazu.
//
// Bewusst außerhalb der versionierten Naht: der Katalog liegt unter /mcp/v1 und
// nicht unter /v1.0, deshalb baut er hier nicht auf useUmpBase() auf.
//
// Fällt der Aufruf aus, gibt es keine Kennzeichnung statt einer falschen: eine
// leere Liste heißt „von keinem Modell wissen wir, dass es offen steht", nicht
// „keines steht offen".
interface McpTool { tool?: string }
interface McpKatalog { tools?: McpTool[] }

export function useUmpRunnableProcesses() {
  const { umpBase } = useRuntimeConfig().public

  return useFetch<McpKatalog>(`${umpBase}/mcp/v1/tools`, {
    key: 'ump-ausfuehrbare-prozesse',
    default: () => [] as string[],
    transform: (raw): string[] =>
      (raw?.tools ?? []).map(t => t.tool).filter((t): t is string => typeof t === 'string'),
    // Ein Fehler hier darf die Startseite nicht mitreißen, sie funktioniert auch
    // ohne die Kennzeichnung.
    onResponseError() {},
  })
}
