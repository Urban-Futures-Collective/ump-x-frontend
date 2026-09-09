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
// Auch listJobs gefolgt von showJob passt darunter.
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
lassen; bei growbike ist "auto" genau so gemeint, das Feld bleibt dann leer.

Antworte knapp und in der Sprache der Frage. Schreib Fließtext ohne Markdown:
keine Sternchen, keine Rauten, keine Tabellen, keine Klammer-Links. Die Seite
zeigt deine Antwort als reinen Text an, Auszeichnungen bleiben als Zeichen stehen.
Aufzählungen höchstens als kurze Zeilen mit einem Bindestrich davor.`

// Der Verlauf steht auf Modulebene und nicht im Composable-Aufruf. Die Schublade
// hängt das Panel beim Schließen aus, und mit ihm wäre die Unterhaltung weg,
// obwohl der Nutzer sie nur kurz aus dem Weg geschoben hat. So überlebt sie das
// Schließen und auch den Wechsel von der Startseite in die Anwendung.
//
// Unbedenklich auf Modulebene, weil der Chat ausschließlich im Browser läuft
// (das Panel steckt in ClientOnly): auf dem Server entstünde sonst Zustand, den
// sich fremde Anfragen teilen.
const nachrichten = ref<Nachricht[]>([])
const status = ref<ChatStatus>('ready')
const fehler = ref<string | null>(null)

// Ebenfalls hier oben: sonst hält ein neu eingehängtes Panel einen anderen
// Controller als der Strom, der noch läuft, und „Abbrechen" träfe ins Leere.
let abbruch: AbortController | null = null

// Den Verlauf übers Neuladen retten, und zwar in sessionStorage, nicht in
// localStorage. Er gehört zu diesem Besuch in diesem Tab: er verschwindet, wenn
// der Tab zugeht, ein zweiter Tab fängt bei null an, und niemand findet Wochen
// später seine alten Fragen auf einem geteilten Rechner wieder.
//
// Was hier landet, sind Fragen, Antworten und Werkzeug-Ergebnisse. Der Schlüssel
// des Anbieters ist NICHT dabei, der wohnt in useAiProvider, und der UMP-Bearer
// erreicht den Browser ohnehin nicht.
const SPEICHER = 'ump-x-chat'

// Ein Werkzeug-Ergebnis kann ein paar Kilobyte wiegen. Die Grenze verhindert,
// dass ein langer Verlauf am Speicherlimit des Browsers scheitert; gekürzt wird
// nur das Gespeicherte, nicht das, was auf dem Schirm steht.
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
    // Kaputter oder fremder Inhalt: lieber leer anfangen als beim Laden stehen
    // bleiben. Der Chat ist nichts, wofür sich eine Wiederherstellung lohnt.
    nachrichten.value = []
  }
}

// Eine Nachricht ohne sichtbaren Inhalt. Das ist die Antwortblase, die vor dem
// Absenden angelegt wird: bleibt sie leer, weil der Anbieter nicht antwortet,
// gehört sie weder auf den Schirm noch in den Speicher. Der Anbieterfehler
// erreicht uns erst nach dem Ende des Stroms, also nach dem Sichern.
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
    // Voll oder gesperrt (privates Fenster, blockierte Website-Daten). Der
    // Verlauf im Arbeitsspeicher bleibt gültig, nur das Neuladen überlebt er
    // dann nicht. Kein Grund, den Chat abzubrechen.
  }
}

// Auf Modulebene, damit das Abmelden sie aufrufen kann, ohne useAiChat() zu
// benutzen: das Composable zieht die UMP-Werkzeuge mit hoch und braucht dafür
// einen Nuxt-Kontext, den die Abmeldung nicht herstellen soll.
//
// Der Verlauf enthält die Fragen des Nutzers und die Daten seiner Läufe. Wer
// sich abmeldet, lässt sonst beides im Browser zurück, auf einem geteilten
// Rechner für den Nächsten.
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

  // „Verlauf löschen" im Kopf der Schublade und das Abmelden tun dasselbe.
  const neu = vergissVerlauf

  async function senden(eingabe: string) {
    const text = eingabe.trim()
    if (!text || laeuft.value) return

    fehler.value = null
    nachrichten.value.push({ id: crypto.randomUUID(), role: 'user', parts: [{ type: 'text', text }] })

    // Reihenfolge ist hier Verhalten, nicht Geschmack. UChatMessages springt beim
    // Wechsel auf 'submitted' zur letzten Nachricht und polstert den Verlauf so
    // auf, dass die Frage immer ganz oben landet — auch wenn die Antwort kurz
    // ist und unten Platz wäre. Das ist die ChatGPT-Anordnung, gewollt ist hier
    // aber ein gewöhnlicher Chat: der Verlauf wächst nach unten und rutscht erst
    // hoch, wenn er nicht mehr passt.
    //
    // Abschalten lässt sich der Sprung nicht, er hat keinen Schalter. Er feuert
    // aber nur, wenn die letzte Nachricht vom Nutzer ist. Die leere Antwortblase
    // steht deshalb absichtlich VOR dem Statuswechsel. Fürs Mitlaufen während des
    // Streams sorgt should-auto-scroll am Panel.
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
      // Einmal am Ende statt bei jedem Zeichen: ein watch auf den Verlauf würde
      // während des Stroms pro Delta die ganze Unterhaltung serialisieren.
      sichern()
    }
  }

  return { nachrichten, status, fehler, laeuft, senden, abbrechen, neu }
}
