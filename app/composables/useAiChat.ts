import { stepCountIs, streamText } from 'ai'

// Der Chat-Lauf. Bewusst NICHT useChat aus @ai-sdk/vue: das setzt eine
// Serverroute voraus, die das UI-Message-Protokoll streamt, also genau den
// Server, den wir nicht bauen wollen. Hier läuft streamText im Browser und die
// Nachrichtenliste schreiben wir selbst.
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

// Mehr Schritte als nötig kosten Geld des Nutzers, weniger schneiden die
// Antwort ab. Zwei Werkzeuge hintereinander plus Antwort sind drei Schritte;
// sechs lassen Luft für eine Nachfrage, ohne dass eine Schleife ausufert.
const MAX_SCHRITTE = 6

const SYSTEM = `Du hilfst Menschen bei der Urban Model Platform (UMP), einer offenen Plattform,
die städtische Simulationsmodelle verschiedener Anbieter hinter einer gemeinsamen
Schnittstelle bündelt (OGC API Processes). Ein Lauf heißt hier Szenario.

Du hast zwei Werkzeuge:
- listProcesses: die Modelle im Katalog, mit der Angabe, ob der Nutzer sie ausführen darf.
- describeProcess: die Eingaben eines Modells mit Typ, Vorgabe und erlaubten Werten.

Benutze sie, statt zu raten. Nenne nie ein Modell, einen Parameter oder einen Wert,
den du nicht aus einem Werkzeug hast. Liefert ein Werkzeug ein Feld "fehler", gib
den Grund wieder, statt ihn zu umschreiben.

Du kannst nichts starten und nichts ändern. Fragt jemand nach einem Lauf, erkläre
die Parameter und verweise auf das Formular unter Neues Szenario.

Eine Eingabe ohne Vorgabe muss der Nutzer setzen. Eine mit Vorgabe darf er leer
lassen; bei growbike ist "auto" genau so gemeint, das Feld bleibt dann leer.

Antworte knapp und in der Sprache der Frage.`

export function useAiChat() {
  const { sprachmodell } = useAiProvider()
  const { werkzeuge } = useUmpTools()

  const nachrichten = ref<Nachricht[]>([])
  const status = ref<ChatStatus>('ready')
  const fehler = ref<string | null>(null)

  let abbruch: AbortController | null = null

  const laeuft = computed(() => status.value === 'submitted' || status.value === 'streaming')

  function abbrechen() {
    abbruch?.abort()
    abbruch = null
    if (laeuft.value) status.value = 'ready'
  }

  function neu() {
    abbrechen()
    nachrichten.value = []
    fehler.value = null
    status.value = 'ready'
  }

  async function senden(eingabe: string) {
    const text = eingabe.trim()
    if (!text || laeuft.value) return

    fehler.value = null
    nachrichten.value.push({ id: crypto.randomUUID(), role: 'user', parts: [{ type: 'text', text }] })

    const antwort: Nachricht = { id: crypto.randomUUID(), role: 'assistant', parts: [] }
    nachrichten.value.push(antwort)
    status.value = 'submitted'

    // Text landet im letzten Teil, solange der Text ist. Nach einem Werkzeug
    // beginnt ein neuer, damit die Reihenfolge Text, Werkzeug, Text erhalten
    // bleibt und die Karte an der Stelle steht, an der sie aufgerufen wurde.
    const textZiel = () => {
      const letzter = antwort.parts[antwort.parts.length - 1]
      if (letzter?.type === 'text') return letzter
      const neuer = { type: 'text' as const, text: '' }
      antwort.parts.push(neuer)
      return neuer
    }

    const leer = () => antwort.parts.every(p => p.type === 'text' && !p.text)
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
        // Nur der Text der bisherigen Runden. Werkzeugaufrufe früherer Runden
        // muss das Modell nicht noch einmal sehen, das bläht nur die Anfrage.
        messages: nachrichten.value
          .filter(n => n !== antwort)
          .map(n => ({
            role: n.role,
            content: n.parts.filter(p => p.type === 'text').map(p => p.text).join(''),
          })),
        tools: werkzeuge,
        stopWhen: stepCountIs(MAX_SCHRITTE),
        abortSignal: abbruch.signal,
        // streamText wirft nicht: ein Anbieterfehler beendet den Strom still
        // und wird nur hier gemeldet. Am 2026-09-04 gegen einen lokalen Server
        // mit falschem Schlüssel gemessen.
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
      // Abbruch ist kein Fehler, sondern das, was der Knopf verspricht.
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
    }
  }

  return { nachrichten, status, fehler, laeuft, senden, abbrechen, neu }
}
