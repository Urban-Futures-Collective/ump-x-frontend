import { jsonSchema, tool } from 'ai'
import type { OgcJob, OgcJobList } from '~/composables/useUmpJobs'
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
// Alle Werkzeuge lesen. Der Chat kann nichts starten und nichts verändern, auch
// nicht auf Zuruf: Werkzeuge, die es nicht gibt, kann sich kein Modell herbeireden.

// So viele Läufe gehen an das Modell. Wer mehr sehen will, öffnet die Liste; ein
// Verlauf über Monate im Kontext kostet nur Geld und beantwortet keine Frage.
const MAX_LAEUFE = 20

interface McpKatalog { tools?: { tool?: string }[] }

export function useUmpTools() {
  const { base } = useUmpBase()
  const { umpBase } = useRuntimeConfig().public
  // Ergebnisse laufen über dieselbe Naht wie Karte und Download, nicht über
  // einen zweiten Abruf daneben.
  const { fetchResult } = useUmpResult()

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
    // Die Schlüssel dieses Schemas liest ein fremdes Sprachmodell, nicht unser
    // Code. Deshalb heißen sie englisch, anders als die Bezeichner im Repo: am
    // 2026-09-07 hat ein lokales Modell auf Staging „geben" und „gabenein"
    // geraten, statt „eingaben" zu treffen, und schickte dreimal einen Aufruf
    // ohne Eingaben los.
    inputSchema: jsonSchema<{ processId: string, inputs?: Record<string, unknown> }>({
      type: 'object',
      properties: {
        processId: {
          type: 'string',
          description: 'Die vollständige Id mit Anbieter-Präfix.',
        },
        inputs: {
          type: 'object',
          description: 'Die Eingaben als Objekt, Schlüssel sind die Parameternamen des Modells.',
          additionalProperties: true,
        },
      },
      required: ['processId'],
      additionalProperties: false,
    }),
    async execute({ processId, inputs }) {
      try {
        const roh = await $fetch<OgcProcessDetail>(`${base}/processes/${processId}`)
        const felder = Object.entries(roh.inputs ?? {}).map(([name, v]) => ({
          name,
          type: v.schema?.type ?? 'string',
          default: v.schema?.default,
          pflicht: (v.minOccurs ?? 0) >= 1 && v.schema?.default === undefined,
        }))

        const gegeben = inputs ?? {}
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

  // Welche Läufe zurückkommen, entscheidet die API anhand des Tokens, den der
  // Proxy anhängt. Abgemeldet ist die Liste NICHT leer: am 2026-09-04 gegen
  // Produktion gemessen antwortet /jobs ohne Sitzung mit den Läufen, die ohne
  // Anmeldung gestartet wurden (heute ausschließlich growbike). Deshalb steht
  // hier „zugänglich" und nicht „eigene": das Modell soll einem anonymen
  // Besucher nicht erzählen, er sehe seine eigenen Läufe.
  const listJobs = tool({
    description:
      'Listet die Läufe (Szenarien), die dem Aufrufer zugänglich sind, neueste zuerst, mit '
      + 'Modell, Status und Zeitpunkt. Angemeldet sind das die eigenen, abgemeldet die ohne '
      + 'Anmeldung gestarteten. Ohne Parameter aufrufen.',
    inputSchema: jsonSchema<Record<string, never>>({
      type: 'object',
      properties: {},
      additionalProperties: false,
    }),
    async execute() {
      try {
        const roh = await $fetch<OgcJobList>(`${base}/jobs`)
        const laeufe = neuesteZuerst((roh?.jobs ?? []).map(toJob))
          .slice(0, MAX_LAEUFE)
          .map(j => ({
            id: j.id,
            prozess: j.processId,
            status: j.status,
            fortschritt: j.progress,
            zeit: jobTime(j),
          }))
        return {
          laeufe,
          ...(laeufe.length
            ? {}
            : { hinweis: 'Keine Läufe vorhanden.' }),
        }
      }
      catch (e) {
        return alsFehler(e)
      }
    },
  })

  const showJob = tool({
    description:
      'Zeigt einen Lauf: Status, Fortschritt, Zeiten und die Meldung der Plattform. Ist er '
      + 'durchgelaufen, kommt eine Zusammenfassung des Ergebnisses dazu: Anzahl der Objekte, '
      + 'Geometrietypen, Ausdehnung, Eigenschaften. Die Geodaten selbst gibt es hier nicht, '
      + 'dafür steht der Link auf die Seite des Laufs.',
    inputSchema: jsonSchema<{ jobId: string }>({
      type: 'object',
      properties: {
        jobId: {
          type: 'string',
          description: 'Die Id des Laufs, wie sie listJobs liefert.',
        },
      },
      required: ['jobId'],
      additionalProperties: false,
    }),
    async execute({ jobId }) {
      try {
        const job = toJob(await $fetch<OgcJob>(`${base}/jobs/${jobId}`))
        const grund = {
          id: job.id,
          prozess: job.processId,
          status: job.status,
          fortschritt: job.progress,
          meldung: job.message,
          erstellt: jobTime(job),
          beendet: job.finished,
          dauer: formatDuration(job.created, job.finished) ?? undefined,
          link: `/jobs/${job.id}`,
        }
        // Bei einem gescheiterten Lauf antwortet /results mit 404 „Job failed",
        // deshalb gar nicht erst fragen. Siehe useUmpJob.
        if (job.status !== 'successful') return grund
        try {
          const layer = await fetchResult(job.id, job.processId)
          // Das GeoJSON bleibt im Browser. Was hier zurückgeht, sind vier Zahlen.
          return { ...grund, ergebnis: fasseErgebnisZusammen(layer.featureCollection) }
        }
        catch (e) {
          // Ergebnisse älterer Läufe können weg sein, obwohl der Lauf erfolgreich
          // war. Der Lauf selbst bleibt eine brauchbare Auskunft.
          return { ...grund, ergebnisFehler: apiErrorMessage(e) }
        }
      }
      catch (e) {
        return alsFehler(e)
      }
    },
  })

  return { werkzeuge: { listProcesses, describeProcess, prepareRun, listJobs, showJob } }
}
