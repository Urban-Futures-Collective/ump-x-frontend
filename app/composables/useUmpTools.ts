import { jsonSchema, tool } from 'ai'
import type { OgcProcessDetail } from '~/composables/useUmpProcess'
import type { OgcProcessList } from '~/composables/useUmpProcesses'

// Die Werkzeuge, die der Chat benutzen darf. Einzige Naht zwischen Modell und
// Backend, deshalb `useUmp*` benannt: Backend-Zugriff gehört laut AGENTS.md
// ausschließlich hierher, nicht in Komponenten.
//
// Bewusst NICHT über den MCP-Server. Der ist die Tür für fremde Clients; unsere
// eigene Seite sitzt schon hinter dem /ump-Proxy, der den Bearer aus der Session
// anhängt. Ein Werkzeugaufruf trägt damit automatisch die Rechte des
// angemeldeten Nutzers, und abgemeldet eben nur die anonymen.
//
// Fassung 1 liest nur. Der Chat kann nichts starten und nichts verändern, auch
// nicht auf Zuruf: Werkzeuge, die es nicht gibt, kann sich kein Modell herbeireden.

interface McpKatalog { tools?: { tool?: string }[] }

export function useUmpTools() {
  const { base } = useUmpBase()
  const { umpBase } = useRuntimeConfig().public

  // Fehler werden zurückgegeben statt geworfen. Ein 401 ist für den Chat keine
  // Störung, sondern eine Auskunft: „dafür brauchst du eine Rolle" ist eine
  // brauchbare Antwort, ein abgebrochener Strom nicht.
  const alsFehler = (e: unknown) => ({ fehler: apiErrorMessage(e) })

  const listProcesses = tool({
    description:
      'Listet die Modelle im Katalog der Urban Model Platform, mit Titel, Beschreibung '
      + 'und der Angabe, ob der aktuelle Nutzer sie ausführen darf. Ohne Parameter aufrufen.',
    inputSchema: jsonSchema<Record<string, never>>({
      type: 'object',
      properties: {},
      additionalProperties: false,
    }),
    async execute() {
      try {
        const liste = await $fetch<OgcProcessList>(`${base}/processes`)
        // Der MCP-Werkzeugkatalog filtert nach derselben Regel, die auch beim
        // Ausführen gilt. Er ist damit die ehrlichste Auskunft darüber, was der
        // Aufrufer wirklich starten dürfte. Fällt er aus, lassen wir die Angabe
        // weg statt sie zu raten.
        let ausfuehrbar: string[] | null = null
        try {
          const katalog = await $fetch<McpKatalog>(`${umpBase}/mcp/v1/tools`)
          ausfuehrbar = (katalog?.tools ?? [])
            .map(t => t.tool)
            .filter((t): t is string => typeof t === 'string')
        }
        catch {
          ausfuehrbar = null
        }

        return {
          modelle: (liste.processes ?? []).map(p => ({
            id: p.id,
            titel: p.title ?? p.id,
            beschreibung: p.description ?? '',
            ...(ausfuehrbar ? { ausfuehrbar: ausfuehrbar.includes(p.id) } : {}),
          })),
        }
      }
      catch (e) {
        return alsFehler(e)
      }
    },
  })

  const describeProcess = tool({
    description:
      'Beschreibt ein Modell und seine Eingaben: Typ, Vorgabe, ob Pflicht, plus das '
      + 'JSON-Schema mit erlaubten Werten. Vor jedem Vorschlag für einen Lauf aufrufen, '
      + 'damit die Parameternamen stimmen.',
    inputSchema: jsonSchema<{ processId: string }>({
      type: 'object',
      properties: {
        processId: {
          type: 'string',
          description: 'Die vollständige Id mit Anbieter-Präfix, etwa bikebox-modelserver:growbike.',
        },
      },
      required: ['processId'],
      additionalProperties: false,
    }),
    async execute({ processId }) {
      try {
        // Der Doppelpunkt im Präfix darf nicht kodiert werden, UMP 3.x weist
        // Ids ohne Doppelpunkt mit 400 ab. Siehe useUmpProcess.
        const roh = await $fetch<OgcProcessDetail>(`${base}/processes/${processId}`)
        return {
          id: roh.id,
          titel: roh.title ?? roh.id,
          beschreibung: roh.description ?? '',
          eingaben: Object.entries(roh.inputs ?? {}).map(([name, v]) => ({
            name,
            titel: v.title ?? name,
            beschreibung: v.description ?? '',
            pflicht: (v.minOccurs ?? 0) >= 1 && v.schema?.default === undefined,
            vorgabe: v.schema?.default,
            schema: v.schema,
          })),
        }
      }
      catch (e) {
        return alsFehler(e)
      }
    },
  })

  const prepareRun = tool({
    description:
      'Bereitet einen Lauf vor, OHNE ihn zu starten. Prüft die Eingaben gegen das Schema '
      + 'des Modells und liefert einen Link auf das ausgefüllte Formular. Erst describeProcess '
      + 'aufrufen, damit die Namen stimmen. Lass Eingaben weg, die eine Vorgabe haben.',
    inputSchema: jsonSchema<{ processId: string, eingaben?: Record<string, unknown> }>({
      type: 'object',
      properties: {
        processId: {
          type: 'string',
          description: 'Die vollständige Id mit Anbieter-Präfix.',
        },
        eingaben: {
          type: 'object',
          description: 'Die Eingaben als Objekt, Schlüssel sind die Parameternamen.',
          additionalProperties: true,
        },
      },
      required: ['processId'],
      additionalProperties: false,
    }),
    async execute({ processId, eingaben }) {
      try {
        const roh = await $fetch<OgcProcessDetail>(`${base}/processes/${processId}`)
        const felder = Object.entries(roh.inputs ?? {}).map(([name, v]) => ({
          name,
          type: v.schema?.type ?? 'string',
          default: v.schema?.default,
          pflicht: (v.minOccurs ?? 0) >= 1 && v.schema?.default === undefined,
        }))

        const gegeben = eingaben ?? {}
        const unbekannt = Object.keys(gegeben).filter(k => !felder.some(f => f.name === k))
        // Dieselbe Regel wie im Formular, nicht eine zweite daneben.
        const rumpf = bereinigeEingaben(felder, gegeben)
        const fehlend = felder
          .filter(f => f.pflicht && rumpf[f.name] === undefined)
          .map(f => f.name)

        // Tieflink statt geteiltem Zustand: übersteht ein Neuladen und lässt
        // sich weitergeben. Abgeschickt wird im Formular, von Hand.
        const suche = new URLSearchParams({ process: processId })
        for (const [k, v] of Object.entries(rumpf)) suche.set(`in.${k}`, String(v))

        return {
          prozess: processId,
          eingaben: rumpf,
          weggelassen: felder
            .filter(f => rumpf[f.name] === undefined && f.default !== undefined)
            .map(f => f.name),
          fehlend,
          unbekannt,
          link: `/run?${suche.toString()}`,
          hinweis: 'Nicht gestartet. Der Link öffnet das ausgefüllte Formular, abschicken muss der Nutzer.',
        }
      }
      catch (e) {
        return alsFehler(e)
      }
    },
  })

  return { werkzeuge: { listProcesses, describeProcess, prepareRun } }
}
