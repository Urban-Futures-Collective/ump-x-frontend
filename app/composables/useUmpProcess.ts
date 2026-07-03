import type { ProcessDetail } from '~/types/ump'

interface OgcInput {
  title?: string
  description?: string
  minOccurs?: number
  schema?: { type?: string, default?: unknown }
}
interface OgcProcessDetail {
  id: string
  title?: string
  description?: string
  version?: string
  keywords?: string[]
  inputs?: Record<string, OgcInput>
}

// Prozess-Detail inkl. Inputs-Schema (für das dynamische Parameterformular).
// OGC → ProcessDetail-Domänenmodell.
export function useUmpProcess(id: MaybeRefOrGetter<string>) {
  const { base } = useUmpBase()
  return useFetch<OgcProcessDetail>(() => `${base}/processes/${toValue(id)}`, {
    query: { f: 'json' },
    transform: (raw): ProcessDetail => ({
      id: raw.id,
      title: raw.title ?? raw.id,
      description: raw.description ?? '',
      version: raw.version ?? '',
      keywords: raw.keywords ?? [],
      inputs: Object.entries(raw.inputs ?? {}).map(([key, v]) => ({
        name: key,
        title: v.title ?? key,
        description: v.description,
        type: v.schema?.type ?? 'string',
        required: (v.minOccurs ?? 0) >= 1,
        default: v.schema?.default,
      })),
    }),
  })
}
