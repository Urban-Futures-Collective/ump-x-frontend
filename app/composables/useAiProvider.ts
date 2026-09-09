import { createAnthropic } from '@ai-sdk/anthropic'
import { createOpenAI } from '@ai-sdk/openai'
import type { LanguageModel } from 'ai'

// Zugang zum Sprachmodell des Nutzers.
//
// UMP-X stellt kein Modell und bezahlt keines. Der Nutzer bringt Anbieter,
// Schlüssel und Modellnamen mit, und der Aufruf geht aus dem Browser direkt
// zum Anbieter. Unser Server sieht den Schlüssel nie — das ist keine
// Bequemlichkeit, sondern der Grund für den ganzen Zuschnitt: wir wollen für
// KI-Aufrufe weder zahlen noch haften.
//
// Drei Anbieter sind vorbereitet, dazu „kompatibel" für alles, was die
// OpenAI-Form spricht (Groq, Mistral, LM Studio, Ollama, oMLX …). Am
// 2026-09-04 gemessen, dass alle drei Aufrufe direkt aus dem Browser zulassen;
// Anthropic aber nur mit dem Kopf anthropic-dangerous-direct-browser-access.
export type Anbieter = 'openrouter' | 'openai' | 'anthropic' | 'kompatibel'

export interface Zugang {
  anbieter: Anbieter
  modell: string
  basisUrl: string
}

const SPEICHER = 'ump-x-ki'

export const ANBIETER_VORGABEN: Record<Anbieter, { basisUrl: string, modell: string }> = {
  openrouter: { basisUrl: 'https://openrouter.ai/api/v1', modell: 'anthropic/claude-sonnet-4' },
  openai: { basisUrl: 'https://api.openai.com/v1', modell: 'gpt-4.1-mini' },
  anthropic: { basisUrl: 'https://api.anthropic.com/v1', modell: 'claude-sonnet-4-20250514' },
  kompatibel: { basisUrl: 'http://localhost:8000/v1', modell: '' },
}

// Der Schlüssel liegt bewusst NICHT in einem Ref und wird nicht zurückgegeben.
// So kann ihn niemand versehentlich in ein Template rendern oder in eine
// Fehlermeldung schreiben; er verlässt dieses Modul nur Richtung Provider.
let schluessel = ''

// Ob einer da ist, muss die Oberfläche trotzdem erfahren. Deshalb ein
// getrennter, reaktiver Merker: er trägt nur „ja oder nein", nie den Wert.
const schluesselDa = ref(false)

const zugang = ref<Zugang>({ anbieter: 'openrouter', ...ANBIETER_VORGABEN.openrouter })
const geladen = ref(false)

function laden() {
  if (geladen.value || !import.meta.client) return
  geladen.value = true
  try {
    const roh = localStorage.getItem(SPEICHER)
    if (!roh) return
    const gespeichert = JSON.parse(roh) as Partial<Zugang> & { schluessel?: string }
    if (gespeichert.anbieter && gespeichert.anbieter in ANBIETER_VORGABEN) {
      zugang.value = {
        anbieter: gespeichert.anbieter,
        modell: gespeichert.modell ?? ANBIETER_VORGABEN[gespeichert.anbieter].modell,
        basisUrl: gespeichert.basisUrl ?? ANBIETER_VORGABEN[gespeichert.anbieter].basisUrl,
      }
    }
    schluessel = gespeichert.schluessel ?? ''
    schluesselDa.value = schluessel.length > 0
  }
  catch {
    // Kaputter Eintrag ist kein Grund, die Seite mitzureißen: dann eben ohne.
  }
}

function sichern() {
  if (!import.meta.client) return
  localStorage.setItem(SPEICHER, JSON.stringify({ ...zugang.value, schluessel }))
}

// Auf Modulebene, damit das Abmelden sie aufrufen kann, ohne vorher
// useAiProvider() zu benutzen: das würde laden() auslösen und den Schlüssel
// erst in den Speicher holen, um ihn dann zu löschen.
export function vergissZugang() {
  schluessel = ''
  schluesselDa.value = false
  if (import.meta.client) localStorage.removeItem(SPEICHER)
}

export function useAiProvider() {
  laden()

  const hatSchluessel = readonly(schluesselDa)

  function setzeZugang(neu: Zugang, neuerSchluessel: string) {
    zugang.value = { ...neu }
    schluessel = neuerSchluessel
    schluesselDa.value = schluessel.length > 0
    sichern()
  }

  // Baut das Modellobjekt fürs AI SDK. Einzige Stelle, die die Provider-
  // Fabriken kennt, und die einzige, die den Schlüssel zu sehen bekommt.
  function sprachmodell(): LanguageModel {
    const { anbieter, modell, basisUrl } = zugang.value
    if (!schluessel) throw new Error('Kein Schlüssel hinterlegt.')
    if (!modell) throw new Error('Kein Modell angegeben.')

    if (anbieter === 'anthropic') {
      const provider = createAnthropic({
        apiKey: schluessel,
        // Ohne diesen Kopf lehnt Anthropic die CORS-Vorabfrage mit 400 ab.
        headers: { 'anthropic-dangerous-direct-browser-access': 'true' },
        fetch: browserFetch,
      })
      return provider(modell)
    }

    // Alles andere spricht die OpenAI-Form. Bewusst .chat() statt der
    // Vorgabe: die Responses-API kennen OpenRouter und lokale Server nicht.
    const provider = createOpenAI({ apiKey: schluessel, baseURL: basisUrl, fetch: browserFetch })
    return provider.chat(modell)
  }

  return { zugang: readonly(zugang), hatSchluessel, setzeZugang, vergessen: vergissZugang, sprachmodell }
}
