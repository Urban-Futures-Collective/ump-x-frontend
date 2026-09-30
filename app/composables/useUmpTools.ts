import { jsonSchema, tool } from 'ai'
import type { OgcJob, OgcJobList } from '~/composables/useUmpJobs'
import type { OgcProcessDetail } from '~/composables/useUmpProcess'
import type { OgcProcessList } from '~/composables/useUmpProcesses'

// The tools the chat may use. This is the only seam between model and backend,
// hence the `useUmp*` name: backend access belongs in useUmp* composables, not
// in components.
//
// Deliberately not via the MCP server, which is for external clients. Our page
// already sits behind the /ump proxy that attaches the session's bearer token,
// so every tool call carries the signed-in user's rights (or anonymous rights).
//
// All tools are read-only. The chat cannot start or change anything, since no
// such tool exists for a model to call.

// Max jobs passed to the model. Months of history in the context only cost money.
const MAX_LAEUFE = 20

export function useUmpTools() {
  const { base } = useUmpBase()
  // Results go through the same path as map and download, not a separate fetch.
  const { fetchResult } = useUmpResult()

  // Errors are returned, not thrown. A 401 is useful information for the chat
  // ("you need a role for that"), whereas a thrown error would abort the stream.
  const alsFehler = (e: unknown) => ({ fehler: apiErrorMessage(e) })

  const listProcesses = tool({
    description:
      'Listet die Modelle im Katalog der Urban Model Platform, mit Id, Titel und '
      + 'Beschreibung. Ob der aktuelle Nutzer ein Modell ausführen darf, steht nicht darin. '
      + 'Ohne Parameter aufrufen.',
    inputSchema: jsonSchema<Record<string, never>>({
      type: 'object',
      properties: {},
      additionalProperties: false,
    }),
    async execute() {
      try {
        const liste = await $fetch<OgcProcessList>(`${base}/processes`)

        return {
          modelle: (liste.processes ?? []).map(p => ({
            id: p.id,
            titel: p.title ?? p.id,
            beschreibung: p.description ?? '',
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
          description: 'Die vollständige Id im Format <anbieter>:<prozess>, so wie listProcesses sie liefert.',
        },
      },
      required: ['processId'],
      additionalProperties: false,
    }),
    async execute({ processId }) {
      try {
        // Do not encode the colon in the prefix: UMP 3.x rejects ids without it
        // with 400. See useUmpProcess.
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
    // These schema keys are read by an external language model, not our code,
    // hence English names unlike the German identifiers elsewhere.
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
        // Same rule as the run form, not a second copy.
        const rumpf = bereinigeEingaben(felder, gegeben)
        const fehlend = felder
          .filter(f => f.pflicht && rumpf[f.name] === undefined)
          .map(f => f.name)

        // A deep link instead of shared state: survives a reload and can be shared.
        // The user submits the form manually.
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

  // The API decides which jobs are returned, based on the token the proxy attaches.
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
        // For a failed job /results returns 404 "Job failed", so skip it. See useUmpJob.
        if (job.status !== 'successful') return grund
        try {
          const layer = await fetchResult(job.id, job.processId)
          // The GeoJSON stays in the browser; only a small summary goes to the model.
          return { ...grund, ergebnis: fasseErgebnisZusammen(layer.featureCollection) }
        }
        catch (e) {
          // Results of older jobs may be gone even though the job succeeded;
          // the job info alone is still useful.
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
