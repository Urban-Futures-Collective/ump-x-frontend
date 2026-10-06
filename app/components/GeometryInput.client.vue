<script setup lang="ts">
import { createMap } from '@masterportal/masterportalapi/src/maps/ol/olMap.js'
import type Feature from 'ol/Feature'
import OlFeature from 'ol/Feature'
import type { Geometry } from 'ol/geom'
import { LineString as OlLineString, Point as OlPoint, Polygon as OlPolygon } from 'ol/geom'
import { Draw, Modify } from 'ol/interaction'
import TileLayer from 'ol/layer/Tile'
import VectorLayer from 'ol/layer/Vector'
import type Map from 'ol/Map'
import { fromLonLat, toLonLat, transformExtent } from 'ol/proj'
import OSM from 'ol/source/OSM'
import VectorSource from 'ol/source/Vector'
import { getArea } from 'ol/sphere'
import { Circle, Fill, Stroke, Style } from 'ol/style'
import 'ol/ol.css'

// Map input for a geometry parameter (an area, points such as trees). The value is the
// GeoJSON geometry as JSON text, so the form keeps one kind of value for every field
// and a prepared link (`?in.area=...`) works as for any other input.
//
// What can be drawn follows the input's schema (see app/utils/geometryInput.ts): polygons
// for an area, points for locations; several shapes only if the Multi* type is allowed.
const props = defineProps<{ modelValue: string, schema?: Record<string, unknown> }>()
const emit = defineEmits<{ 'update:modelValue': [string] }>()

const { t, locale } = useI18n()

const types = computed(() => allowedGeometryTypes(props.schema))
const kind = computed(() => drawKind(types.value))
const many = computed(() => allowsMany(types.value, kind.value))

const mapContainer = ref<HTMLDivElement | null>(null)
let map: Map | undefined
let observer: ResizeObserver | undefined
const source = new VectorSource()

const COLOR = '#2563eb'
const style = new Style({
  stroke: new Stroke({ color: COLOR, width: 2 }),
  fill: new Fill({ color: 'rgba(37, 99, 235, 0.15)' }),
  image: new Circle({ radius: 6, fill: new Fill({ color: COLOR }), stroke: new Stroke({ color: '#fff', width: 2 }) }),
})

// Coordinates go out in WGS 84 with six decimals (about 10 cm): more digits only
// lengthen the request.
function round(c: unknown): unknown {
  return Array.isArray(c) ? c.map(round) : typeof c === 'number' ? Math.round(c * 1e6) / 1e6 : c
}

function partOf(f: Feature<Geometry>): unknown {
  const g = f.getGeometry()
  if (g instanceof OlPoint) return round(toLonLat(g.getCoordinates()))
  if (g instanceof OlLineString) return round(g.getCoordinates().map(c => toLonLat(c)))
  if (g instanceof OlPolygon) return round(g.getCoordinates().map(ring => ring.map(c => toLonLat(c))))
  return null
}

function featureOf(part: unknown): Feature<Geometry> | null {
  if (!Array.isArray(part)) return null
  if (kind.value === 'Point') return new OlFeature(new OlPoint(fromLonLat(part as number[])))
  if (kind.value === 'LineString') return new OlFeature(new OlLineString((part as number[][]).map(c => fromLonLat(c))))
  return new OlFeature(new OlPolygon((part as number[][][]).map(ring => ring.map(c => fromLonLat(c)))))
}

// The value last sent up, so an echo of our own change does not redraw the shapes.
let lastEmitted = props.modelValue
const areaKm2 = ref(0)
const count = ref(0)

function emitValue() {
  const features = source.getFeatures()
  count.value = features.length
  areaKm2.value = features.reduce((sum, f) => {
    const g = f.getGeometry()
    return g instanceof OlPolygon ? sum + getArea(g) / 1e6 : sum
  }, 0)
  const geometry = toGeometry(kind.value, types.value, features.map(partOf).filter(p => p !== null))
  lastEmitted = geometry ? JSON.stringify(geometry) : ''
  emit('update:modelValue', lastEmitted)
}

function loadValue(text: string) {
  source.clear(true)
  let parsed: unknown = null
  try {
    parsed = text ? JSON.parse(text) : null
  }
  catch {
    // Not a geometry; the form marks the field.
  }
  for (const part of partsOf(parsed, kind.value)) {
    const f = featureOf(part)
    if (f) source.addFeature(f)
  }
  count.value = source.getFeatures().length
  areaKm2.value = source.getFeatures().reduce((sum, f) => {
    const g = f.getGeometry()
    return g instanceof OlPolygon ? sum + getArea(g) / 1e6 : sum
  }, 0)
  fitToShapes()
}

function fitToShapes() {
  const extent = source.getExtent()
  if (!map || !extent || !source.getFeatures().length || !Number.isFinite(extent[0])) return
  map.getView().fit(extent, { padding: [32, 32, 32, 32], maxZoom: 16 })
}

watch(() => props.modelValue, (v) => {
  if (v !== lastEmitted) {
    lastEmitted = v
    loadValue(v)
  }
})

watch(mapContainer, (el) => {
  if (el && !map) buildMap(el)
}, { flush: 'post', immediate: true })

onBeforeUnmount(() => {
  observer?.disconnect()
  map?.setTarget(undefined)
  map = undefined
})

function buildMap(el: HTMLDivElement) {
  map = createMap({ ...useMapConfig(), target: el }) as Map
  map.addLayer(new TileLayer({ source: new OSM() }))
  map.addLayer(new VectorLayer({ source, style }))

  const draw = new Draw({ source, type: kind.value, style })
  // Without Multi* only one shape is allowed: a new one replaces the old.
  draw.on('drawstart', () => { if (!many.value) source.clear() })
  draw.on('drawend', () => { setTimeout(emitValue) })
  map.addInteraction(draw)

  const modify = new Modify({ source })
  modify.on('modifyend', emitValue)
  map.addInteraction(modify)

  loadValue(props.modelValue)

  observer = new ResizeObserver(() => map?.updateSize())
  observer.observe(el.parentElement ?? el)
}

function clearShapes() {
  source.clear()
  emitValue()
}

// Place search to jump to an area. Nominatim is the OpenStreetMap search service; the
// map tiles come from OpenStreetMap as well.
interface Place { display_name: string, boundingbox: [string, string, string, string] }
const query = ref('')
const places = ref<Place[]>([])
const searching = ref(false)
const searchError = ref(false)

async function search() {
  const q = query.value.trim()
  if (!q) return
  searching.value = true
  searchError.value = false
  try {
    places.value = await $fetch<Place[]>('https://nominatim.openstreetmap.org/search', {
      query: { q, format: 'jsonv2', limit: 5 },
      headers: { 'accept-language': locale.value },
    })
  }
  catch {
    places.value = []
    searchError.value = true
  }
  finally {
    searching.value = false
  }
}

function goTo(p: Place) {
  const [south, north, west, east] = p.boundingbox.map(Number) as [number, number, number, number]
  map?.getView().fit(transformExtent([west, south, east, north], 'EPSG:4326', 'EPSG:3857'), { padding: [16, 16, 16, 16], maxZoom: 16 })
  places.value = []
}

const hint = computed(() => t(`geometry.hint.${kind.value}`))
</script>

<template>
  <div class="space-y-2">
    <!-- Not a <form>: this sits inside the run form, and forms cannot be nested. Enter
         searches instead of submitting the run. -->
    <div class="flex gap-2">
      <UInput v-model="query" icon="i-lucide-search" :placeholder="t('geometry.search')" size="sm" class="flex-1" @keydown.enter.prevent="search" />
      <UButton type="button" size="sm" variant="subtle" :loading="searching" @click="search">
        {{ t('geometry.searchButton') }}
      </UButton>
    </div>
    <ul v-if="places.length" class="divide-y divide-(--ui-border) rounded-md border border-(--ui-border) bg-white text-sm">
      <li v-for="p in places" :key="p.display_name">
        <button type="button" class="w-full px-3 py-1.5 text-left hover:bg-(--ui-bg-elevated)" @click="goTo(p)">
          {{ p.display_name }}
        </button>
      </li>
    </ul>
    <p v-if="searchError" class="text-xs text-red-600">
      {{ t('geometry.searchError') }}
    </p>

    <div class="h-80 w-full overflow-hidden rounded-lg border border-(--ui-border)">
      <div ref="mapContainer" class="h-full w-full" />
    </div>

    <div class="flex flex-wrap items-center justify-between gap-2 text-xs text-(--ui-text-muted)">
      <span>
        {{ hint }}
        <template v-if="kind === 'Polygon' && count">
          · {{ t('geometry.area', { km2: areaKm2.toLocaleString(locale, { maximumFractionDigits: 2 }) }) }}
        </template>
        <template v-else-if="kind !== 'Polygon' && count">
          · {{ t('geometry.count', { n: count }) }}
        </template>
      </span>
      <UButton v-if="count" size="xs" variant="ghost" color="neutral" icon="i-lucide-trash-2" @click="clearShapes">
        {{ t('geometry.clear') }}
      </UButton>
    </div>
  </div>
</template>
