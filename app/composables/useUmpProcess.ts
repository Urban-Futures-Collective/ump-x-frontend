import type { ProcessDetail } from '~/types/ump'

interface OgcInput {
  title?: string
  description?: string
  minOccurs?: number
  schema?: { type?: string, default?: unknown }
}
interface OgcProcessDetail {
  id: string
  title?: string | null
  description?: string | null
  version?: string
  keywords?: string[] | null
  inputs?: Record<string, OgcInput> | null
}

// Prozess-Detail inkl. Inputs-Schema (für das dynamische Parameterformular).
// OGC → ProcessDetail-Domänenmodell.
//
// Die id trägt seit jeher das Provider-Präfix (`modelserver-1:abm-test-model`);
// UMP 3.x weist Ids ohne Doppelpunkt mit 400 ab. Der Doppelpunkt ist in einem
// Pfadsegment erlaubt und darf deshalb nicht kodiert werden.
export function useUmpProcess(id: MaybeRefOrGetter<string>) {
  const { base } = useUmpBase()
  return useFetch<OgcProcessDetail>(() => `${base}/processes/${toValue(id)}`, {
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
