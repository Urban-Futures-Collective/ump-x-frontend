// Key figures and a legend a model can send along with a GeoJSON result, as members of
// the FeatureCollection next to `features`:
//
//   "x-ump-indicators": [
//     { "id": "dead_end_share", "title": { "en": "Dead ends", "de": "Sackgassen" },
//       "value": 0.23, "unit": "%", "description": { "en": "…", "de": "…" } }
//   ],
//   "x-ump-legend": [
//     { "title": { "en": "quiet", "de": "ruhig" }, "color": "#fde68a" }
//   ]
//
// Texts (title, unit, description) are a plain string or a map of language codes. Values are numbers or short
// text. Anything that does not match this shape is left out rather than shown wrongly.
// The `x-ump-` prefix marks this as an agreement between model servers and UMP-X, not
// part of GeoJSON or OGC API Processes.

export type LocalText = string | Record<string, string>

export interface Indicator {
  id: string
  title: string
  value: string
  description?: string
}

export interface LegendEntry {
  title: string
  color: string
}

const COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i

/** Text in the given language, else English, else the first language there is. */
export function localText(text: unknown, locale: string): string | undefined {
  if (typeof text === 'string') return text
  if (!text || typeof text !== 'object') return undefined
  const map = text as Record<string, unknown>
  const pick = map[locale] ?? map.en ?? Object.values(map)[0]
  return typeof pick === 'string' ? pick : undefined
}

function formatValue(value: unknown, unit: unknown, locale: string): string | undefined {
  let text: string
  if (typeof value === 'number' && Number.isFinite(value)) {
    text = value.toLocaleString(locale, { maximumFractionDigits: 2 })
  }
  else if (typeof value === 'string' && value.trim()) {
    text = value.trim()
  }
  else {
    return undefined
  }
  return typeof unit === 'string' && unit.trim() ? `${text} ${unit.trim()}` : text
}

export function indicatorsOf(result: unknown, locale: string): Indicator[] {
  const list = (result as Record<string, unknown> | null)?.['x-ump-indicators']
  if (!Array.isArray(list)) return []
  return list.flatMap((raw, i) => {
    if (!raw || typeof raw !== 'object') return []
    const item = raw as Record<string, unknown>
    const title = localText(item.title, locale)
    const value = formatValue(item.value, localText(item.unit, locale), locale)
    if (!title || value === undefined) return []
    return [{
      id: typeof item.id === 'string' ? item.id : `indicator-${i}`,
      title,
      value,
      description: localText(item.description, locale),
    }]
  })
}

export function legendOf(result: unknown, locale: string): LegendEntry[] {
  const list = (result as Record<string, unknown> | null)?.['x-ump-legend']
  if (!Array.isArray(list)) return []
  return list.flatMap((raw) => {
    if (!raw || typeof raw !== 'object') return []
    const item = raw as Record<string, unknown>
    const title = localText(item.title, locale)
    const color = item.color
    if (!title || typeof color !== 'string' || !COLOR.test(color)) return []
    return [{ title, color }]
  })
}
