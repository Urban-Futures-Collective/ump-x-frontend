// Colours a result brings along per feature, as simplestyle properties
// (https://github.com/mapbox/simplestyle-spec): fill, fill-opacity, stroke,
// stroke-width, stroke-opacity, marker-color. A model can thus colour its classes
// meaningfully without the map knowing the model.

export interface SimpleStyle {
  fill?: string
  stroke?: string
  strokeWidth?: number
  marker?: string
}

const COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i

// "#rrggbb" plus an opacity as an rgba() string; only hex colours are accepted.
function withOpacity(color: unknown, opacity: unknown): string | undefined {
  if (typeof color !== 'string' || !COLOR.test(color)) return undefined
  const hex = color.length === 4 ? color.slice(1).split('').map(c => c + c).join('') : color.slice(1)
  const [r, g, b] = [0, 2, 4].map(i => Number.parseInt(hex.slice(i, i + 2), 16))
  const a = typeof opacity === 'number' && opacity >= 0 && opacity <= 1 ? opacity : 1
  return `rgba(${r}, ${g}, ${b}, ${a})`
}

// The style a feature asks for, or null if it carries no simplestyle properties.
export function simpleStyleOf(props: Record<string, unknown> | null | undefined): SimpleStyle | null {
  if (!props) return null
  const style: SimpleStyle = {
    fill: withOpacity(props.fill, props['fill-opacity'] ?? 0.6),
    stroke: withOpacity(props.stroke, props['stroke-opacity']),
    strokeWidth: typeof props['stroke-width'] === 'number' ? props['stroke-width'] : undefined,
    marker: withOpacity(props['marker-color'], 1),
  }
  return style.fill || style.stroke || style.marker ? style : null
}
