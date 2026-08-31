<script setup lang="ts">
import type { FeatureCollection, Geometry, Position } from 'geojson'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'

const props = defineProps<{ data?: FeatureCollection | null }>()

// Klassischer Template-Ref auf einem INNEREN div (nicht dem Component-Root) — vermeidet
// ein Hydration-Timing-Problem, bei dem der Root-Ref im onMounted noch null ist.
const mapContainer = ref<HTMLDivElement | null>(null)
let map: maplibregl.Map | undefined

const SRC = 'ump-result'
// Kein API-Key nötig: schlichter Raster-Style mit OSM-Tiles.
const OSM_STYLE = {
  version: 8 as const,
  sources: {
    osm: {
      type: 'raster' as const,
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '© OpenStreetMap contributors',
    },
  },
  layers: [{ id: 'osm', type: 'raster' as const, source: 'osm' }],
}

onMounted(async () => {
  await nextTick()
  const el = mapContainer.value
  if (!el) return
  map = new maplibregl.Map({
    container: el,
    style: OSM_STYLE,
    center: [10.0, 53.55], // Hamburg
    zoom: 8,
  })
  map.addControl(new maplibregl.NavigationControl({}), 'top-right')
  map.on('load', () => render(props.data))
})

onBeforeUnmount(() => {
  map?.remove()
  map = undefined
})

watch(() => props.data, d => render(d))

function eachCoord(geom: Geometry, cb: (pos: Position) => void) {
  if (geom.type === 'GeometryCollection') {
    geom.geometries.forEach(g => eachCoord(g, cb))
    return
  }
  const walk = (c: unknown) => {
    if (Array.isArray(c) && typeof c[0] === 'number') cb(c as Position)
    else if (Array.isArray(c)) c.forEach(walk)
  }
  walk(geom.coordinates)
}

function render(fc?: FeatureCollection | null) {
  if (!map || !map.isStyleLoaded()) return
  for (const id of ['ump-line', 'ump-point']) {
    if (map.getLayer(id)) map.removeLayer(id)
  }
  if (map.getSource(SRC)) map.removeSource(SRC)
  if (!fc?.features?.length) return

  map.addSource(SRC, { type: 'geojson', data: fc })
  map.addLayer({
    id: 'ump-line',
    type: 'line',
    source: SRC,
    filter: ['match', ['geometry-type'], ['LineString', 'MultiLineString'], true, false],
    paint: { 'line-color': '#2563eb', 'line-width': 2 },
  })
  map.addLayer({
    id: 'ump-point',
    type: 'circle',
    source: SRC,
    filter: ['match', ['geometry-type'], ['Point', 'MultiPoint'], true, false],
    paint: { 'circle-radius': 5, 'circle-color': '#2563eb', 'circle-stroke-width': 1, 'circle-stroke-color': '#fff' },
  })

  const bounds = new maplibregl.LngLatBounds()
  let has = false
  for (const f of fc.features) {
    if (!f.geometry) continue
    eachCoord(f.geometry, ([lng, lat]) => { bounds.extend([lng, lat]); has = true })
  }
  if (has) map.fitBounds(bounds, { padding: 48, maxZoom: 14, duration: 600 })
}
</script>

<template>
  <!-- Quadratisch statt fester Höhe: Ergebnisse sind Stadtgebiete, und die sind in
       beide Richtungen ähnlich weit ausgedehnt. Ein breiter, flacher Ausschnitt
       zwingt fitBounds herauszuzoomen, bis das Netz in der Mitte klein wird.
       Die Obergrenze hält die Karte trotzdem auf einen Bildschirm, sonst wird sie
       in einer breiten Spalte höher als das Fenster. -->
  <div class="mx-auto aspect-square w-full max-w-[calc(100svh_-_9rem)] overflow-hidden rounded-lg border border-(--ui-border)">
    <div ref="mapContainer" class="h-full w-full" />
  </div>
</template>
