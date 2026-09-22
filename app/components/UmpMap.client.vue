<script setup lang="ts">
import type { FeatureCollection } from 'geojson'
import { createMap } from '@masterportal/masterportalapi/src/maps/ol/olMap.js'
import GeoJSON from 'ol/format/GeoJSON'
import TileLayer from 'ol/layer/Tile'
import VectorLayer from 'ol/layer/Vector'
import type Map from 'ol/Map'
import OSM from 'ol/source/OSM'
import VectorSource from 'ol/source/Vector'
import { Circle, Fill, Stroke, Style } from 'ol/style'
import 'ol/ol.css'

// Die Karte. Seit dem 2026-09-22 OpenLayers über die masterportalapi statt
// MapLibre, siehe Sprint 011.
//
// Bewusst NICHT über `src/maps/map.js`: dessen createMap importiert olcs und
// zieht damit Cesium ins Bundle, obwohl 3D nicht gebraucht wird. Der Einstieg
// über `src/maps/ol/olMap.js` ist geprüft frei davon.
//
// Der Ergebnis-Layer entsteht hier von Hand und nicht über die Bibliothek: deren
// GeoJSON-Layer liest Inline-Features mit fest verdrahtetem
// featureProjection EPSG:25832 (src/layer/vector.js). Auf einer 3857-Karte läge
// unser Netz damit an der falschen Stelle.
const props = defineProps<{ data?: FeatureCollection | null }>()

// Klassischer Template-Ref auf einem INNEREN div (nicht dem Component-Root) — vermeidet
// ein Hydration-Timing-Problem, bei dem der Root-Ref im onMounted noch null ist.
const mapContainer = ref<HTMLDivElement | null>(null)
let map: Map | undefined
let ergebnis: VectorLayer<VectorSource> | undefined
let beobachter: ResizeObserver | undefined

const format = new GeoJSON()

// Linien und Punkte in derselben Farbe wie zuvor, damit der Vergleich mit dem
// alten Stand nur die Kartentechnik zeigt und nicht auch noch das Aussehen.
const LINIE = '#2563eb'
const stil = new Style({
  stroke: new Stroke({ color: LINIE, width: 2 }),
  image: new Circle({
    radius: 5,
    fill: new Fill({ color: LINIE }),
    stroke: new Stroke({ color: '#fff', width: 1 }),
  }),
})

onMounted(async () => {
  await nextTick()
  const el = mapContainer.value
  if (!el) return

  map = createMap({ ...useMapConfig(), target: el }) as Map
  // Kein Eintrag im Dienste-Register: die Bibliothek kennt keinen XYZ-Typ, und
  // einen Service-Eintrag zu erfinden wäre unehrlich. Fertige OL-Layer nimmt ihr
  // addLayer unverändert an.
  map.addLayer(new TileLayer({ source: new OSM() }))
  render(props.data)

  // Beim Einhängen hat der Kasten noch keine Größe, und OpenLayers zeichnet dann
  // nie, auch wenn die Größe gleich danach steht. Der Beobachter meldet die erste
  // echte Größe nach und fängt später jede Änderung der Fensterbreite mit ab.
  //
  // Beobachtet wird der äußere Rahmen, NICHT das Element, in das OpenLayers
  // zeichnet: dort legt es sein Canvas hinein, der Kasten wächst, der Beobachter
  // feuert erneut, und die Karte schaukelt sich auf mehrere tausend Pixel Breite
  // hoch. Der äußere Rahmen hat seine Größe dagegen aus dem Layout.
  beobachter = new ResizeObserver(() => map?.updateSize())
  beobachter.observe(el.parentElement ?? el)
})

onBeforeUnmount(() => {
  beobachter?.disconnect()
  beobachter = undefined
  map?.setTarget(undefined)
  map = undefined
  ergebnis = undefined
})

watch(() => props.data, d => render(d))

function render(fc?: FeatureCollection | null) {
  if (!map) return

  if (ergebnis) {
    map.removeLayer(ergebnis)
    ergebnis = undefined
  }
  if (!fc?.features?.length) return

  // Die Projektion steht hier ausdrücklich: GeoJSON ist nach RFC 7946 in WGS 84,
  // die Karte rechnet in Web Mercator.
  const features = format.readFeatures(fc, {
    dataProjection: 'EPSG:4326',
    featureProjection: 'EPSG:3857',
  })

  ergebnis = new VectorLayer({ source: new VectorSource({ features }), style: stil })
  map.addLayer(ergebnis)

  const extent = ergebnis.getSource()?.getExtent()
  if (!extent || !Number.isFinite(extent[0])) return
  map.getView().fit(extent, {
    padding: [48, 48, 48, 48],
    // Nicht näher als Stufe 14 heran: ein einzelner Punkt würde die Karte sonst
    // bis an die Kachelgrenze aufziehen.
    minResolution: 9.5546285356,
    duration: 600,
  })
}
</script>

<template>
  <!-- Quadratisch statt fester Höhe: Ergebnisse sind Stadtgebiete, und die sind in
       beide Richtungen ähnlich weit ausgedehnt. Ein breiter, flacher Ausschnitt
       zwingt die Karte herauszuzoomen, bis das Netz in der Mitte klein wird.
       Die Obergrenze hält die Karte trotzdem auf einen Bildschirm, sonst wird sie
       in einer breiten Spalte höher als das Fenster. -->
  <div class="mx-auto aspect-square w-full max-w-[calc(100svh_-_9rem)] overflow-hidden rounded-lg border border-(--ui-border)">
    <div ref="mapContainer" class="h-full w-full" />
  </div>
</template>
