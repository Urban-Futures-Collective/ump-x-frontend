<script setup lang="ts">
import { createMap } from '@masterportal/masterportalapi/src/maps/ol/olMap.js'
import GeoJSON from 'ol/format/GeoJSON'
import TileLayer from 'ol/layer/Tile'
import VectorLayer from 'ol/layer/Vector'
import type Map from 'ol/Map'
import OSM from 'ol/source/OSM'
import VectorSource from 'ol/source/Vector'
import { Circle, Fill, Stroke, Style } from 'ol/style'
import type { ResultLayer } from '~/types/ump'
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

const { t } = useI18n()

// Template ref on an INNER div, not the component root, which avoids a
// hydration timing issue where the root ref is still null.
const mapContainer = ref<HTMLDivElement | null>(null)
let map: Map | undefined
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

// No layers means nothing mappable: show a notice instead of an empty map.
const mappable = computed(() => (props.layer?.layers.length ?? 0) > 0)

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
  map = createMap({ ...useMapConfig(), target: el }) as Map
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
  observer?.disconnect()
  observer = undefined
  map?.setTarget(undefined)
  map = undefined
  resultLayer = undefined
}

watch(() => props.layer, l => render(l))

function render(layer?: ResultLayer | null) {
  if (!map) return

  if (resultLayer) {
    map.removeLayer(resultLayer)
    resultLayer = undefined
  }
  const spec = layer?.layers[0]
  const fc = layer?.featureCollection
  if (!spec || !fc?.features?.length) return

  // GeoJSON is WGS 84 per RFC 7946; the map uses Web Mercator.
  const features = format.readFeatures(fc, {
    dataProjection: 'EPSG:4326',
    featureProjection: 'EPSG:3857',
  })

  resultLayer = new VectorLayer({ source: new VectorSource({ features }), style: styles[spec.geometry] })
  map.addLayer(resultLayer)

  const extent = resultLayer.getSource()?.getExtent()
  if (!extent || !Number.isFinite(extent[0])) return
  map.getView().fit(extent, {
    padding: [48, 48, 48, 48],
    // Cap at zoom level 14, otherwise a single point zooms to the max tile level.
    minResolution: 9.5546285356,
    duration: 600,
  })
}
</script>

<template>
  <!-- Square rather than fixed height: results are city areas of similar width
       and height, and a wide, flat frame forces the map to zoom out too far.
       The max width keeps the square within one screen height. -->
  <div v-if="mappable" class="mx-auto aspect-square w-full max-w-[calc(100svh_-_9rem)] overflow-hidden rounded-lg border border-(--ui-border)">
    <div ref="mapContainer" class="h-full w-full" />
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
