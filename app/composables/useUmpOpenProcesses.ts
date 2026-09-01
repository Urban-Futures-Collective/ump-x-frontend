// Welche Prozesse darf ein Aufrufer ohne Anmeldung ausführen?
//
// Die Prozessliste beantwortet das nicht: Sie ist auf Produktion ungefiltert
// (`UMP_PUBLIC_PROCESSES`), zeigt also jedem alles. Der MCP-Werkzeugkatalog
// filtert dagegen nach genau der Regel, die auch beim Ausführen gilt, und liefert
// damit anonym die Prozesse mit `anonymous-access: true`. Am 2026-08-31 gemessen:
// /v1.0/processes gibt vier Modelle zurück, /mcp/v1/tools eines.
//
// Bewusst außerhalb der versionierten Naht: der Katalog liegt unter /mcp/v1 und
// nicht unter /v1.0, deshalb baut er hier nicht auf useUmpBase() auf.
//
// Fällt der Aufruf aus, gibt es keine Kennzeichnung statt einer falschen: eine
// leere Liste heißt „von keinem Modell wissen wir, dass es offen steht", nicht
// „keines steht offen".
interface McpTool { tool?: string }
interface McpKatalog { tools?: McpTool[] }

export function useUmpOpenProcesses() {
  const { umpBase } = useRuntimeConfig().public

  return useFetch<McpKatalog>(`${umpBase}/mcp/v1/tools`, {
    key: 'ump-offene-prozesse',
    default: () => [] as string[],
    transform: (raw): string[] =>
      (raw?.tools ?? []).map(t => t.tool).filter((t): t is string => typeof t === 'string'),
    // Ein Fehler hier darf die Startseite nicht mitreißen, sie funktioniert auch
    // ohne die Kennzeichnung.
    onResponseError() {},
  })
}
