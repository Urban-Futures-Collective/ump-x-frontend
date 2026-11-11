// The attributes of a feature someone clicks on the result map, as rows to show. The
// colour a model sets per feature (simplestyle, see simplestyle.ts) is left out: it is
// how the map draws the feature, not something about the feature.

const STYLE_KEYS = new Set([
  'fill',
  'fill-opacity',
  'stroke',
  'stroke-width',
  'stroke-opacity',
  'marker-color',
  'marker-size',
  'marker-symbol',
])

export interface FeatureAttribute {
  key: string
  value: string
}

function formatValue(value: unknown, locale: string): string {
  if (typeof value === 'number') return value.toLocaleString(locale, { maximumFractionDigits: 3 })
  if (typeof value === 'string') return value
  if (typeof value === 'boolean') return String(value)
  return JSON.stringify(value)
}

/** Rows for a feature's properties, in the order the model sent them; empty values are left out. */
export function featureAttributes(props: Record<string, unknown> | null | undefined, locale = 'en'): FeatureAttribute[] {
  if (!props) return []
  return Object.entries(props)
    .filter(([key, value]) => key !== 'geometry' && !STYLE_KEYS.has(key) && value !== undefined && value !== null && value !== '')
    .map(([key, value]) => ({ key, value: formatValue(value, locale) }))
}
