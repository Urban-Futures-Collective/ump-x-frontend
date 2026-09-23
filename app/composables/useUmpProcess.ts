import type { ProcessDetail } from '~/types/ump'

export interface OgcInput {
  title?: string
  description?: string
  minOccurs?: number
  schema?: { type?: string, default?: unknown }
}
export interface OgcProcessDetail {
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
        // Pflicht ist nur, was der Aufrufer wirklich liefern muss. `minOccurs`
        // allein reicht dafür nicht: growbike führt jede Eingabe mit
        // minOccurs 1, gibt aber den meisten eine Vorgabe. Ein Stern an einem
        // Feld, das man leer lassen darf und für „auto" sogar leer lassen
        // MUSS, verlangt etwas Falsches.
        required: (v.minOccurs ?? 0) >= 1 && v.schema?.default === undefined,
        default: v.schema?.default,
        // Das Original dazu, nicht nur type und default. Das Formular braucht
        // nur die zwei Felder, ein Werkzeugschema für die KI will aber auch
        // enum, minimum und maximum kennen, sonst rät das Modell.
        schema: v.schema as Record<string, unknown> | undefined,
      })),
    }),
  })
}
