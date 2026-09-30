import { createAnthropic } from '@ai-sdk/anthropic'
import { createOpenAI } from '@ai-sdk/openai'
import type { LanguageModel } from 'ai'

// Access to the user's own language model (bring your own key).
//
// UMP-X neither provides nor pays for a model. The user supplies provider, key
// and model name, and calls go from the browser straight to the provider. Our
// server never sees the key, so we neither pay for nor are liable for AI calls.
//
// Three providers are preset, plus "kompatibel" for anything speaking the OpenAI
// API (Groq, Mistral, LM Studio, Ollama, ...). All three allow direct browser
// calls; Anthropic only with the anthropic-dangerous-direct-browser-access header.
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

// The key is deliberately not a ref and never returned, so it cannot end up in a
// template or error message by accident. It only leaves this module to the provider.
let schluessel = ''

// The UI still needs to know whether a key exists: a separate reactive flag
// carries only yes/no, never the value.
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
    // A corrupt entry must not break the page; continue without it.
  }
}

function sichern() {
  if (!import.meta.client) return
  localStorage.setItem(SPEICHER, JSON.stringify({ ...zugang.value, schluessel }))
}

// Module-level so logout can call it without useAiProvider(), which would run
// laden() and load the key into memory only to delete it.
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

  // Builds the AI SDK model object. The only place that knows the provider
  // factories and the only one that sees the key.
  function sprachmodell(): LanguageModel {
    const { anbieter, modell, basisUrl } = zugang.value
    if (!schluessel) throw new Error('Kein Schlüssel hinterlegt.')
    if (!modell) throw new Error('Kein Modell angegeben.')

    if (anbieter === 'anthropic') {
      const provider = createAnthropic({
        apiKey: schluessel,
        // Without this header Anthropic rejects the CORS preflight with 400.
        headers: { 'anthropic-dangerous-direct-browser-access': 'true' },
        fetch: browserFetch,
      })
      return provider(modell)
    }

    // Everything else speaks the OpenAI API. .chat() instead of the default,
    // because OpenRouter and local servers do not support the Responses API.
    const provider = createOpenAI({ apiKey: schluessel, baseURL: basisUrl, fetch: browserFetch })
    return provider.chat(modell)
  }

  return { zugang: readonly(zugang), hatSchluessel, setzeZugang, vergessen: vergissZugang, sprachmodell }
}
