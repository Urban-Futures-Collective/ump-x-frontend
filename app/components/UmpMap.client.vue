<script setup lang="ts">
import { createMap } from '@masterportal/masterportalapi/src/maps/ol/olMap.js'
import type { FeatureLike } from 'ol/Feature'
import GeoJSON from 'ol/format/GeoJSON'
import TileLayer from 'ol/layer/Tile'
import VectorLayer from 'ol/layer/Vector'
import type OlMap from 'ol/Map'
import OSM from 'ol/source/OSM'
import VectorSource from 'ol/source/Vector'
import { Circle, Fill, Stroke, Style } from 'ol/style'
import type { ResultLayer } from '~/types/ump'
import { asCollection, loadUrl, MAX_FEATURES, type LinkedLayer } from '~/utils/linkedLayers'
import 'ol/ol.css'

// Result map, built with OpenLayers via the masterportalapi.
//
// Imports createMap from `src/maps/ol/olMap.js`, not `src/maps/map.js`: the
// latter pulls in olcs and therefore Cesium, although no 3D is needed.
//
// The result layer is built by hand: the library's GeoJSON layer reads inline
// features with a hardcoded featureProjection of EPSG:25832
// (src/layer/vector.js), which misplaces them on an EPSG:3857 map.
const props = defineProps<{ layer?: ResultLayer | null }>()

const { t, te, locale } = useI18n()

// Template ref on an INNER div, not the component root, which avoids a
// hydration timing issue where the root ref is still null.
const mapContainer = ref<HTMLDivElement | null>(null)
let map: OlMap | undefined
let resultLayer: VectorLayer<VectorSource> | undefined
let observer: ResizeObserver | undefined

const format = new GeoJSON()

// One color, one style per geometry kind. The kind comes from the layer spec
// produced by `resultLayers`, not from inspecting geometries here.
const COLOR = '#2563eb'
const styles: Record<NonNullable<ResultLayer['layers'][number]>['geometry'], Style> = {
  line: new Style({ stroke: new Stroke({ color: COLOR, width: 2 }) }),
  point: new Style({
    image: new Circle({
      radius: 5,
      fill: new Fill({ color: COLOR }),
      stroke: new Stroke({ color: '#fff', width: 1 }),
    }),
  }),
  polygon: new Style({
    stroke: new Stroke({ color: COLOR, width: 2 }),
    fill: new Fill({ color: 'rgba(37, 99, 235, 0.15)' }),
  }),
  mixed: new Style({
    stroke: new Stroke({ color: COLOR, width: 2 }),
    fill: new Fill({ color: 'rgba(37, 99, 235, 0.15)' }),
    image: new Circle({
      radius: 5,
      fill: new Fill({ color: COLOR }),
      stroke: new Stroke({ color: '#fff', width: 1 }),
    }),
  }),
}

// Colours the result sets per feature (simplestyle), cached per combination so a large
// result does not create one style object per feature.
const styleCache = new Map<string, Style>()
function featureStyle(f: FeatureLike): Style | null {
  const s = simpleStyleOf(f.getProperties())
  if (!s) return null
  const key = `${s.fill}|${s.stroke}|${s.strokeWidth}|${s.marker}`
  let style = styleCache.get(key)
  if (!style) {
    const stroke = s.stroke ? new Stroke({ color: s.stroke, width: s.strokeWidth ?? 1 }) : undefined
    style = new Style({
      fill: s.fill ? new Fill({ color: s.fill }) : undefined,
      stroke,
      image: new Circle({
        radius: 5,
        fill: new Fill({ color: s.marker ?? s.fill ?? COLOR }),
        stroke: new Stroke({ color: '#fff', width: 1 }),
      }),
    })
    styleCache.set(key, style)
  }
  return style
}

// No layers means nothing mappable: show a notice instead of an empty map.
const linked = computed(() => props.layer?.linked ?? [])
const mappable = computed(() => (props.layer?.layers.length ?? 0) > 0 || linked.value.length > 0)

// Linked layers (see app/utils/linkedLayers.ts) are loaded when switched on. The
// boundary starts switched on, so the map shows where the result lies.
const LINKED_COLORS: Record<string, string> = {
  boundary: '#2563eb',
  buildings: '#ea580c',
  trees: '#16a34a',
  land_cover: '#a3a3a3',
  streets: '#7c3aed',
}
const FALLBACK_COLORS = ['#0891b2', '#db2777', '#ca8a04', '#4f46e5']

function colorOf(name: string, i: number): string {
  return LINKED_COLORS[name] ?? FALLBACK_COLORS[i % FALLBACK_COLORS.length]!
}

function linkedStyle(color: string, outlineOnly: boolean): Style {
  return new Style({
    stroke: new Stroke({ color, width: outlineOnly ? 2.5 : 1.5 }),
    fill: outlineOnly ? undefined : new Fill({ color: `${color}40` }),
    image: new Circle({ radius: 3, fill: new Fill({ color }) }),
  })
}

interface LinkedState { on: boolean, loading: boolean, error: boolean, loaded?: number }
const linkedState = ref<Record<string, LinkedState>>({})
const linkedLayers = new Map<string, VectorLayer<VectorSource>>()

function layerTitle(name: string): string {
  const key = `map.layer.${name}`
  return te(key) ? t(key) : name
}

async function setLinked(layer: LinkedLayer, on: boolean) {
  const i = linked.value.indexOf(layer)
  const state = linkedState.value[layer.name] ?? { on: false, loading: false, error: false }
  linkedState.value[layer.name] = { ...state, on }
  const existing = linkedLayers.get(layer.name)
  if (existing) {
    existing.setVisible(on)
    return
  }
  if (!on || state.loading) return

  linkedState.value[layer.name] = { on, loading: true, error: false }
  try {
    // Straight from the model server that serves the layer, not through UMP: the links
    // are public collections.
    const fc = asCollection(await $fetch(loadUrl(layer)))
    if (!fc) throw new Error('not GeoJSON')
    const features = format.readFeatures(fc, { dataProjection: 'EPSG:4326', featureProjection: 'EPSG:3857' })
    const fallback = linkedStyle(colorOf(layer.name, i), layer.name === 'boundary')
    const vl = new VectorLayer({
      source: new VectorSource({ features }),
      style: f => featureStyle(f) ?? fallback,
      visible: linkedState.value[layer.name]?.on ?? true,
      // Areas below lines and points, the boundary on top.
      zIndex: layer.name === 'boundary' ? 3 : layer.name === 'land_cover' ? 1 : 2,
    })
    linkedLayers.set(layer.name, vl)
    map?.addLayer(vl)
    linkedState.value[layer.name] = { on: vl.getVisible(), loading: false, error: false, loaded: features.length }
    if (!resultLayer) fitTo(vl.getSource()?.getExtent())
  }
  catch {
    linkedState.value[layer.name] = { on: false, loading: false, error: true }
  }
}

// More features than one request loads: the map shows only part of the layer.
function truncated(layer: LinkedLayer): boolean {
  return (layer.count ?? 0) > MAX_FEATURES
}

// Build the map when its container appears, not on mount. The container is
// behind `v-if="mappable"`, so the component can mount before any result
// exists and a one-time onMounted would never find it. When the container
// disappears (e.g. a new run starts), tear the map down so the next container
// gets a fresh one.
watch(mapContainer, (el) => {
  if (el && !map) buildMap(el)
  else if (!el && map) teardownMap()
}, { flush: 'post', immediate: true })

onBeforeUnmount(teardownMap)

function buildMap(el: HTMLDivElement) {
  map = createMap({ ...useMapConfig(), target: el }) as OlMap
  // Added as a plain OL layer, not via the service registry: the library has
  // no XYZ service type, and addLayer accepts ready-made OL layers as is.
  map.addLayer(new TileLayer({ source: new OSM() }))
  render(props.layer)

  // On mount the container has no size yet, and OpenLayers then never draws.
  // The observer reports the first real size and later window resizes.
  //
  // Observe the outer frame, NOT the OpenLayers target: OL inserts its canvas
  // there, the target grows, the observer fires again, and the map inflates to
  // thousands of pixels. The outer frame gets its size from the layout.
  observer = new ResizeObserver(() => map?.updateSize())
  observer.observe(el.parentElement ?? el)
}

function teardownMap() {
  linkedLayers.clear()
  linkedState.value = {}
  observer?.disconnect()
  observer = undefined
  map?.setTarget(undefined)
  map = undefined
  resultLayer = undefined
}

watch(() => props.layer, (l) => {
  for (const vl of linkedLayers.values()) map?.removeLayer(vl)
  linkedLayers.clear()
  linkedState.value = {}
  render(l)
})

function showDefaultLinked() {
  const boundary = linked.value.find(l => l.name === 'boundary')
  if (boundary) void setLinked(boundary, true)
}

function fitTo(extent?: number[] | null) {
  if (!map || !extent || !Number.isFinite(extent[0])) return
  map.getView().fit(extent, {
    padding: [48, 48, 48, 48],
    // Cap at zoom level 14, otherwise a single point zooms to the max tile level.
    minResolution: 9.5546285356,
    duration: 600,
  })
}

function render(layer?: ResultLayer | null) {
  if (!map) return

  if (resultLayer) {
    map.removeLayer(resultLayer)
    resultLayer = undefined
  }
  showDefaultLinked()
  const spec = layer?.layers[0]
  const fc = layer?.featureCollection
  if (!spec || !fc?.features?.length) return

  // GeoJSON is WGS 84 per RFC 7946; the map uses Web Mercator.
  const features = format.readFeatures(fc, {
    dataProjection: 'EPSG:4326',
    featureProjection: 'EPSG:3857',
  })

  const fallback = styles[spec.geometry]
  resultLayer = new VectorLayer({ source: new VectorSource({ features }), style: f => featureStyle(f) ?? fallback })
  map.addLayer(resultLayer)

  fitTo(resultLayer.getSource()?.getExtent())
}
</script>

<template>
  <!-- Square rather than fixed height: results are city areas of similar width
       and height, and a wide, flat frame forces the map to zoom out too far.
       The max width keeps the square within one screen height. -->
  <div v-if="mappable" class="space-y-2">
    <div class="mx-auto aspect-square w-full max-w-[calc(100svh_-_9rem)] overflow-hidden rounded-lg border border-(--ui-border)">
      <div ref="mapContainer" class="h-full w-full" />
    </div>

    <!-- Layers the result links to, switched on one by one. -->
    <fieldset v-if="linked.length" class="space-y-1.5">
      <legend class="mb-1 text-sm font-medium">
        {{ t('map.layers') }}
      </legend>
      <div v-for="(l, i) in linked" :key="l.name" class="flex flex-wrap items-center gap-2 text-sm">
        <USwitch
          :model-value="linkedState[l.name]?.on ?? false"
          :loading="linkedState[l.name]?.loading"
          :aria-label="layerTitle(l.name)"
          @update:model-value="on => setLinked(l, on)"
        />
        <span class="inline-block size-3 rounded-sm" :style="{ background: colorOf(l.name, i) }" aria-hidden="true" />
        <span>{{ layerTitle(l.name) }}</span>
        <span v-if="l.count != null" class="text-(--ui-text-dimmed)">{{ t('map.layerCount', { n: l.count.toLocaleString(locale) }) }}</span>
        <span v-if="linkedState[l.name]?.error" class="text-xs text-red-600">{{ t('map.layerError') }}</span>
        <span v-else-if="truncated(l) && linkedState[l.name]?.loaded != null" class="text-xs text-(--ui-text-dimmed)">
          {{ t('map.layerTruncated', { n: linkedState[l.name]!.loaded!.toLocaleString(locale) }) }}
        </span>
      </div>
    </fieldset>
  </div>

  <!-- Nothing mappable: a notice instead of an empty map. The download is still
       available alongside. -->
  <div v-else-if="layer" class="flex items-center gap-3 rounded-lg border border-(--ui-border) bg-(--ui-bg-elevated) p-4">
    <UIcon name="i-lucide-map-off" class="size-5 shrink-0 text-(--ui-text-muted)" />
    <p class="text-sm text-(--ui-text-muted)">
      {{ t('map.notMappable') }}
    </p>
  </div>
</template>
