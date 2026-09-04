import { streamText } from 'ai'

// Der Chat-Lauf. Bewusst NICHT useChat aus @ai-sdk/vue: das setzt eine
// Serverroute voraus, die das UI-Message-Protokoll streamt, also genau den
// Server, den wir nicht bauen wollen. Hier läuft streamText im Browser und die
// Nachrichtenliste schreiben wir selbst.
//
// Die Form { id, role, parts } ist die, die UChatMessages liest; wir bleiben
// bei ihr, damit die Nuxt-UI-Komponenten ohne Umweg funktionieren.
export interface Nachricht {
  id: string
  role: 'user' | 'assistant'
  parts: { type: 'text', text: string }[]
}

export type ChatStatus = 'ready' | 'submitted' | 'streaming' | 'error'

// Fassung 1 hat keine Werkzeuge. Das Modell weiß deshalb nur, was hier steht,
// und darf nichts über den aktuellen Katalog behaupten — sonst erfindet es
// Modellnamen. Ab Schritt 2 übernimmt useUmpTools diesen Teil.
const SYSTEM = `Du hilfst Menschen bei der Urban Model Platform (UMP), einer offenen Plattform,
die städtische Simulationsmodelle verschiedener Anbieter hinter einer gemeinsamen
Schnittstelle bündelt (OGC API Processes). Ein Lauf heißt hier Szenario: man wählt ein
Modell, füllt seine Parameter, startet ihn und bekommt ein Ergebnis, meist als Geodaten
auf einer Karte.

Du hast in dieser Fassung KEINEN Zugriff auf den Katalog, die Läufe oder die Ergebnisse.
Wenn jemand nach konkreten Modellen, Parametern oder eigenen Läufen fragt, sage das
offen und verweise auf den Katalog in der Seitenleiste. Erfinde niemals Modellnamen,
Parameter oder Ergebnisse.

Antworte knapp und in der Sprache der Frage.`

export function useAiChat() {
  const { sprachmodell } = useAiProvider()

  const nachrichten = ref<Nachricht[]>([])
  const status = ref<ChatStatus>('ready')
  const fehler = ref<string | null>(null)

  let abbruch: AbortController | null = null

  const laeuft = computed(() => status.value === 'submitted' || status.value === 'streaming')

  function neu() {
    abbrechen()
    nachrichten.value = []
    fehler.value = null
    status.value = 'ready'
  }

  function abbrechen() {
    abbruch?.abort()
    abbruch = null
    if (laeuft.value) status.value = 'ready'
  }

  async function senden(eingabe: string) {
    const text = eingabe.trim()
    if (!text || laeuft.value) return

    fehler.value = null
    nachrichten.value.push({ id: crypto.randomUUID(), role: 'user', parts: [{ type: 'text', text }] })

    const antwort: Nachricht = { id: crypto.randomUUID(), role: 'assistant', parts: [{ type: 'text', text: '' }] }
    nachrichten.value.push(antwort)
    status.value = 'submitted'

    // streamText wirft nicht: ein Anbieterfehler beendet den textStream still
    // und wird nur über onError gemeldet. Ohne diesen Rückruf sieht der Nutzer
    // eine leere Blase und nie den Grund. Am 2026-09-04 gegen einen lokalen
    // Server mit falschem Schlüssel gemessen.
    const melde = (e: unknown) => {
      status.value = 'error'
      fehler.value = e instanceof Error ? e.message : String(e)
      if (!antwort.parts[0]!.text) nachrichten.value = nachrichten.value.filter(n => n !== antwort)
    }

    abbruch = new AbortController()
    try {
      const ergebnis = streamText({
        model: sprachmodell(),
        system: SYSTEM,
        messages: nachrichten.value
          .filter(n => n !== antwort)
          .map(n => ({ role: n.role, content: n.parts.map(p => p.text).join('') })),
        abortSignal: abbruch.signal,
        onError: ({ error }) => melde(error),
      })

      for await (const stueck of ergebnis.textStream) {
        status.value = 'streaming'
        antwort.parts[0]!.text += stueck
      }
      // onError kann schon gelaufen sein; dann bleibt es beim Fehlerzustand.
      if (status.value !== 'error') status.value = 'ready'
    }
    catch (e) {
      // Abbruch ist kein Fehler, sondern das, was der Knopf verspricht.
      if (e instanceof Error && e.name === 'AbortError') {
        status.value = 'ready'
        if (!antwort.parts[0]!.text) nachrichten.value = nachrichten.value.filter(n => n !== antwort)
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
