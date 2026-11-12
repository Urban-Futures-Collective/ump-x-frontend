import { describe, expect, it } from 'vitest'
import { simpleStyleOf } from './simplestyle'

describe('simpleStyleOf', () => {
  it('reads fill, stroke and opacity', () => {
    expect(simpleStyleOf({ 'fill': '#ff0000', 'fill-opacity': 0.5, 'stroke': '#00f', 'stroke-width': 2 })).toEqual({
      fill: 'rgba(255, 0, 0, 0.5)',
      stroke: 'rgba(0, 0, 255, 1)',
      strokeWidth: 2,
      marker: undefined,
    })
  })

  it('returns null without style properties or with invalid colours', () => {
    expect(simpleStyleOf({ name: 'x' })).toBeNull()
    expect(simpleStyleOf({ fill: 'red' })).toBeNull()
    expect(simpleStyleOf(null)).toBeNull()
  })
})
