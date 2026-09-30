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
export type Provider = 'openrouter' | 'openai' | 'anthropic' | 'kompatibel'

export interface Access {
  provider: Provider
  model: string
  baseUrl: string
}

const STORAGE_KEY = 'ump-x-ki'

export const PROVIDER_DEFAULTS: Record<Provider, { baseUrl: string, model: string }> = {
  openrouter: { baseUrl: 'https://openrouter.ai/api/v1', model: 'anthropic/claude-sonnet-4' },
  openai: { baseUrl: 'https://api.openai.com/v1', model: 'gpt-4.1-mini' },
  anthropic: { baseUrl: 'https://api.anthropic.com/v1', model: 'claude-sonnet-4-20250514' },
  kompatibel: { baseUrl: 'http://localhost:8000/v1', model: '' },
}

// The key is deliberately not a ref and never returned, so it cannot end up in a
// template or error message by accident. It only leaves this module to the provider.
let apiKey = ''

// The UI still needs to know whether a key exists: a separate reactive flag
// carries only yes/no, never the value.
const hasKeyFlag = ref(false)

const access = ref<Access>({ provider: 'openrouter', ...PROVIDER_DEFAULTS.openrouter })
const loaded = ref(false)

function load() {
  if (loaded.value || !import.meta.client) return
  loaded.value = true
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return
    // Entries written before the English rename use German property names
    // (anbieter, modell, basisUrl, schluessel); read both, write only the new ones.
    const stored = JSON.parse(raw) as Partial<Access> & {
      apiKey?: string
      anbieter?: Provider
      modell?: string
      basisUrl?: string
      schluessel?: string
    }
    const storedProvider = stored.provider ?? stored.anbieter
    if (storedProvider && storedProvider in PROVIDER_DEFAULTS) {
      access.value = {
        provider: storedProvider,
        model: stored.model ?? stored.modell ?? PROVIDER_DEFAULTS[storedProvider].model,
        baseUrl: stored.baseUrl ?? stored.basisUrl ?? PROVIDER_DEFAULTS[storedProvider].baseUrl,
      }
    }
    apiKey = stored.apiKey ?? stored.schluessel ?? ''
    hasKeyFlag.value = apiKey.length > 0
  }
  catch {
    // A corrupt entry must not break the page; continue without it.
  }
}

function save() {
  if (!import.meta.client) return
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...access.value, apiKey }))
}

// Module-level so logout can call it without useAiProvider(), which would run
// load() and load the key into memory only to delete it.
export function forgetAccess() {
  apiKey = ''
  hasKeyFlag.value = false
  if (import.meta.client) localStorage.removeItem(STORAGE_KEY)
}

export function useAiProvider() {
  load()

  const hasKey = readonly(hasKeyFlag)

  function setAccess(next: Access, nextKey: string) {
    access.value = { ...next }
    apiKey = nextKey
    hasKeyFlag.value = apiKey.length > 0
    save()
  }

  // Builds the AI SDK model object. The only place that knows the provider
  // factories and the only one that sees the key.
  function languageModel(): LanguageModel {
    const { provider: providerName, model, baseUrl } = access.value
    if (!apiKey) throw new Error('Kein Schlüssel hinterlegt.')
    if (!model) throw new Error('Kein Modell angegeben.')

    if (providerName === 'anthropic') {
      const provider = createAnthropic({
        apiKey,
        // Without this header Anthropic rejects the CORS preflight with 400.
        headers: { 'anthropic-dangerous-direct-browser-access': 'true' },
        fetch: browserFetch,
      })
      return provider(model)
    }

    // Everything else speaks the OpenAI API. .chat() instead of the default,
    // because OpenRouter and local servers do not support the Responses API.
    const provider = createOpenAI({ apiKey, baseURL: baseUrl, fetch: browserFetch })
    return provider.chat(model)
  }

  return { access: readonly(access), hasKey, setAccess, forget: forgetAccess, languageModel }
}
