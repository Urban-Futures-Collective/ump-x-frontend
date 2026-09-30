import { stepCountIs, streamText } from 'ai'

// The chat loop. Deliberately not useChat from @ai-sdk/vue: that requires a
// server route streaming the UI message protocol, which is exactly the server we
// avoid. streamText runs in the browser and we maintain the message list ourselves.
export type Teil =
  | { type: 'text', text: string }
  | {
    type: 'werkzeug'
    toolCallId: string
    name: string
    eingabe?: unknown
    ausgabe?: unknown
    zustand: 'laeuft' | 'fertig' | 'fehler'
  }

export interface Nachricht {
  id: string
  role: 'user' | 'assistant'
  parts: Teil[]
}

export type ChatStatus = 'ready' | 'submitted' | 'streaming' | 'error'

// Extra steps cost the user money, too few cut the answer short. Two chained
// tool calls plus the answer are three steps; six leave room for a follow-up
// without letting a loop run away.
const MAX_SCHRITTE = 6

const SYSTEM = `Du hilfst Menschen bei der Urban Model Platform (UMP), einer offenen Plattform,
die städtische Simulationsmodelle verschiedener Anbieter hinter einer gemeinsamen
Schnittstelle bündelt (OGC API Processes). Ein Lauf heißt hier Szenario.

Du hast fünf Werkzeuge:
- listProcesses: die Modelle im Katalog, mit der Angabe, ob der Nutzer sie ausführen darf.
- describeProcess: die Eingaben eines Modells mit Typ, Vorgabe und erlaubten Werten.
- prepareRun: bereitet einen Lauf vor und liefert einen Link auf das ausgefüllte Formular.
- listJobs: die Läufe, die der Nutzer sehen darf, neueste zuerst.
- showJob: ein einzelner Lauf mit Status und, wenn er durchgelaufen ist, einer
  Zusammenfassung des Ergebnisses.

Benutze sie, statt zu raten. Nenne nie ein Modell, einen Parameter oder einen Wert,
den du nicht aus einem Werkzeug hast. Liefert ein Werkzeug ein Feld "fehler", gib
den Grund wieder, statt ihn zu umschreiben.

Will jemand einen Lauf, rufe erst describeProcess und dann prepareRun auf. Setze nur
Eingaben, die der Nutzer genannt hat; alles mit einer Vorgabe lässt du weg. Du kannst
nichts starten: prepareRun bereitet nur vor, abgeschickt wird im Formular. Sag das
auch so, verspreche keinen Lauf.

Fragt jemand nach seinen Läufen, rufe listJobs auf und für Einzelheiten showJob.
Die Geodaten eines Ergebnisses bekommst du nicht, nur seine Zusammenfassung. Tu
nicht so, als hättest du sie gesehen, und erfinde keine Werte daraus; wer die
Karte oder die Datei braucht, öffnet den Lauf über den Link.

Über die Seite selbst darfst du Auskunft geben, dafür gibt es kein Werkzeug.
UMP-X ist die Weboberfläche der Plattform. Links stehen: Modelle (der Katalog),
Neues Szenario (das Formular), Meine Szenarien (die eigenen Läufe) und Hilfe.
Angemeldet wird über das Konto der Plattform; ohne Anmeldung ist der Katalog
sichtbar und einzelne Modelle sind ausführbar.

Es gibt zwei Wege, die Plattform mit einer KI zu benutzen. Der eine ist dieser
Chat: das Sprachmodell bringt der Nutzer mit, der Aufruf geht aus seinem Browser
direkt zu seinem Anbieter, und der Schlüssel bleibt dort. Der andere ist MCP, ein
offener Standard, über den KI-Clients Werkzeuge fremder Anbieter benutzen können.
UMP-X stellt seine Modelle darüber bereit: wer einen eigenen Client hat, etwa
Claude Desktop, verbindet ihn einmal, meldet sich mit seinem Konto an und hat die
Modelle dort als Werkzeuge, mit genau denselben Rechten wie hier.

Fragt jemand nach MCP, nach dem Verbinden eines Clients oder danach, wie die Seite
zu bedienen ist, erkläre es kurz und verweise auf die Seite Hilfe. In der
Anwendung steht sie links in der Navigation, auf der Startseite führt der
Abschnitt über MCP dorthin. Dort steht die Anleitung samt der Adresse des
MCP-Servers. Diese Adresse nennst du nicht selbst, du kennst sie nicht.

Eine Eingabe ohne Vorgabe muss der Nutzer setzen. Eine mit Vorgabe darf er leer
lassen.

Antworte knapp und in der Sprache der Frage. Schreib Fließtext ohne Markdown:
keine Sternchen, keine Rauten, keine Tabellen, keine Klammer-Links. Die Seite
zeigt deine Antwort als reinen Text an, Auszeichnungen bleiben als Zeichen stehen.
Aufzählungen höchstens als kurze Zeilen mit einem Bindestrich davor.`

// Chat state lives at module level, not per composable call: the drawer unmounts
// the panel on close, which would otherwise drop the conversation. This way it
// survives closing the drawer and navigating from the landing page into the app.
//
// Module-level state is safe here only because the chat runs client-side (the
// panel is wrapped in ClientOnly); on the server it would be shared across requests.
const nachrichten = ref<Nachricht[]>([])
const status = ref<ChatStatus>('ready')
const fehler = ref<string | null>(null)

// Also module-level: otherwise a remounted panel would hold a different controller
// than the running stream, and "cancel" would do nothing.
let abbruch: AbortController | null = null

// History survives a reload via sessionStorage, not localStorage: it belongs to
// this tab's visit, disappears when the tab closes, and does not linger on a
// shared computer.
//
// Stored: questions, answers and tool results. Not stored: the provider key
// (kept in useAiProvider) or the UMP bearer token (never reaches the browser).
const SPEICHER = 'ump-x-chat'

// Tool results can be several kilobytes. This cap keeps a long history within the
// browser's storage quota; only the stored copy is trimmed, not what is on screen.
const MAX_ZEICHEN = 512 * 1024

let geladen = false

function laden() {
  if (geladen || !import.meta.client) return
  geladen = true
  try {
    const roh = sessionStorage.getItem(SPEICHER)
    if (roh) nachrichten.value = JSON.parse(roh) as Nachricht[]
  }
  catch {
    // Corrupt or foreign content: start empty rather than fail on load.
    nachrichten.value = []
  }
}

// A message without visible content, i.e. the placeholder answer bubble created
// before sending. If the provider never answers, it belongs neither on screen nor
// in storage (the provider error only arrives after the stream ends and is saved).
function istLeer(n: Nachricht): boolean {
  return n.parts.every(p => p.type === 'text' && !p.text)
}

function sichern() {
  if (!import.meta.client) return
  try {
    let liste = nachrichten.value.filter(n => !istLeer(n))
    let roh = JSON.stringify(liste)
    while (roh.length > MAX_ZEICHEN && liste.length > 1) {
      liste = liste.slice(1)
      roh = JSON.stringify(liste)
    }
    sessionStorage.setItem(SPEICHER, roh)
  }
  catch {
    // Quota full or storage blocked (private window, blocked site data). The
    // in-memory history stays valid; it just won't survive a reload.
  }
}

// Module-level so logout can call it without useAiChat(), which pulls in the UMP
// tools and needs a Nuxt context. Clearing on logout keeps the user's questions
// and job data from staying behind on a shared computer.
export function vergissVerlauf() {
  abbruch?.abort()
  abbruch = null
  nachrichten.value = []
  fehler.value = null
  status.value = 'ready'
  if (import.meta.client) sessionStorage.removeItem(SPEICHER)
}

export function useAiChat() {
  const { sprachmodell } = useAiProvider()
  const { werkzeuge } = useUmpTools()

  laden()

  const laeuft = computed(() => status.value === 'submitted' || status.value === 'streaming')

  function abbrechen() {
    abbruch?.abort()
    abbruch = null
    if (laeuft.value) status.value = 'ready'
  }

  // "Clear history" in the drawer header does the same as logout.
  const neu = vergissVerlauf

  async function senden(eingabe: string) {
    const text = eingabe.trim()
    if (!text || laeuft.value) return

    fehler.value = null
    nachrichten.value.push({ id: crypto.randomUUID(), role: 'user', parts: [{ type: 'text', text }] })

    // Order matters here. On switching to 'submitted', UChatMessages jumps to the
    // last message and pads the list so the question sits at the top, even for a
    // short answer. We want a plain chat that grows downward instead.
    //
    // The jump has no option to disable it, but it only fires when the last
    // message is from the user, so the empty answer bubble is pushed BEFORE the
    // status change. should-auto-scroll on the panel follows the stream.
    const antwort: Nachricht = { id: crypto.randomUUID(), role: 'assistant', parts: [] }
    nachrichten.value.push(antwort)
    status.value = 'submitted'

    // Append text to the last part while it is text. After a tool call a new text
    // part starts, so each tool card stays where it was called in the answer.
    const textZiel = () => {
      const letzter = antwort.parts[antwort.parts.length - 1]
      if (letzter?.type === 'text') return letzter
      const neuer = { type: 'text' as const, text: '' }
      antwort.parts.push(neuer)
      return neuer
    }

    const leer = () => istLeer(antwort)
    const melde = (e: unknown) => {
      status.value = 'error'
      fehler.value = e instanceof Error ? e.message : String(e)
      if (leer()) nachrichten.value = nachrichten.value.filter(n => n !== antwort)
    }

    abbruch = new AbortController()
    try {
      const ergebnis = streamText({
        model: sprachmodell(),
        system: SYSTEM,
        // Only the text of earlier turns; resending past tool calls just bloats the request.
        messages: nachrichten.value
          .filter(n => n !== antwort)
          .map(n => ({
            role: n.role,
            content: n.parts.filter(p => p.type === 'text').map(p => p.text).join(''),
          })),
        tools: werkzeuge,
        stopWhen: stepCountIs(MAX_SCHRITTE),
        abortSignal: abbruch.signal,
        // streamText does not throw: a provider error ends the stream silently
        // and is only reported here.
        onError: ({ error }) => melde(error),
      })

      for await (const teil of ergebnis.fullStream) {
        status.value = 'streaming'
        if (teil.type === 'text-delta') {
          textZiel().text += teil.text
        }
        else if (teil.type === 'tool-call') {
          antwort.parts.push({
            type: 'werkzeug',
            toolCallId: teil.toolCallId,
            name: teil.toolName,
            eingabe: teil.input,
            zustand: 'laeuft',
          })
        }
        else if (teil.type === 'tool-result' || teil.type === 'tool-error') {
          const karte = antwort.parts.find(
            p => p.type === 'werkzeug' && p.toolCallId === teil.toolCallId,
          )
          if (karte?.type === 'werkzeug') {
            karte.zustand = teil.type === 'tool-result' ? 'fertig' : 'fehler'
            karte.ausgabe = teil.type === 'tool-result' ? teil.output : teil.error
          }
        }
      }
      if (status.value !== 'error') status.value = 'ready'
    }
    catch (e) {
      // A user abort is not an error.
      if (e instanceof Error && e.name === 'AbortError') {
        status.value = 'ready'
        if (leer()) nachrichten.value = nachrichten.value.filter(n => n !== antwort)
      }
      else {
        melde(e)
      }
    }
    finally {
      abbruch = null
      // Save once at the end: a watcher would serialize the whole history on every delta.
      sichern()
    }
  }

  return { nachrichten, status, fehler, laeuft, senden, abbrechen, neu }
}
