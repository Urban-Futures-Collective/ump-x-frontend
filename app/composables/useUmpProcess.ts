import type { ProcessDetail } from '~/types/ump'

export interface OgcInput {
  title?: string
  description?: string
  minOccurs?: number
  schema?: { type?: string, default?: unknown }
  // Model server extensions, see inputKinds.ts. Not standard OGC; ignored if absent.
  'x-ump-group'?: string
  'x-ump-relevant-if'?: Record<string, unknown[]>
}
export interface OgcOutput {
  title?: string
  description?: string
  schema?: { type?: string, format?: string, contentMediaType?: string }
}
export interface OgcProcessDetail {
  id: string
  title?: string | null
  description?: string | null
  version?: string
  keywords?: string[] | null
  inputs?: Record<string, OgcInput> | null
  outputs?: Record<string, OgcOutput> | null
}

// Process detail including the input schemas (for the dynamic parameter
// form), mapped from OGC to the ProcessDetail domain model.
//
// The id carries a provider prefix (`provider:process-id`); UMP 3.x rejects
// ids without the colon with 400. A colon is valid in a path segment, so the
// id must not be URL-encoded.
export function useUmpProcess(id: MaybeRefOrGetter<string>) {
  const { base } = useUmpBase()
  return useFetch(() => `${base}/processes/${toValue(id)}`, {
    transform: (raw: OgcProcessDetail): ProcessDetail => ({
      id: raw.id,
      title: raw.title ?? raw.id,
      description: raw.description ?? '',
      version: raw.version ?? '',
      keywords: raw.keywords ?? [],
      // UMP puts the type under either `format` or `contentMediaType`. Both are
      // passed on; `resultLayers` decides.
      outputs: Object.entries(raw.outputs ?? {}).map(([key, v]) => ({
        name: key,
        title: v.title ?? key,
        description: v.description,
        format: v.schema?.format,
        mediaType: v.schema?.contentMediaType,
        schema: v.schema as Record<string, unknown> | undefined,
      })),
      inputs: Object.entries(raw.inputs ?? {}).map(([key, v]) => ({
        name: key,
        title: v.title ?? key,
        description: v.description,
        type: v.schema?.type ?? 'string',
        // Required only if the caller must supply it. `minOccurs` alone is not
        // enough: some processes mark every input minOccurs 1 but give most a
        // default, and some fields must stay empty to mean "auto".
        required: (v.minOccurs ?? 0) >= 1 && v.schema?.default === undefined,
        default: v.schema?.default,
        // Keep the full schema: the form needs only type and default, but the
        // AI tool schema also needs enum, minimum and maximum.
        schema: v.schema as Record<string, unknown> | undefined,
        group: inputGroup(v['x-ump-group']),
        relevantIf: v['x-ump-relevant-if'],
      })),
    }),
  })
}
