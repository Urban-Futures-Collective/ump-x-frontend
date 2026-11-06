<script setup lang="ts">
import { createMap } from '@masterportal/masterportalapi/src/maps/ol/olMap.js'
import type Feature from 'ol/Feature'
import GeoJSON from 'ol/format/GeoJSON'
import type { Geometry } from 'ol/geom'
import { Draw, Modify, Select, Translate } from 'ol/interaction'
import TileLayer from 'ol/layer/Tile'
import VectorLayer from 'ol/layer/Vector'
import type Map from 'ol/Map'
import OSM from 'ol/source/OSM'
import VectorSource from 'ol/source/Vector'
import { Circle, Fill, Stroke, Style } from 'ol/style'
import 'ol/ol.css'
import type { DrawTool, FeatureProperty } from '~/utils/featureCollection'

// Editor for an input that takes a GeoJSON FeatureCollection (buildings, trees, land
// cover): the features on a map, select to edit their properties, move or reshape them,
// delete them or draw new ones. What can be drawn and which properties a feature has
// come from the input's schema (app/utils/featureCollection.ts). The value stays the
// FeatureCollection as JSON text, like every other field of the form; properties the
// schema does not name are kept as they are.
const props = defineProps<{ modelValue: string, schema?: Record<string, unknown>, area?: string }>()
const emit = defineEmits<{ 'update:modelValue': [string] }>()
const { t } = useI18n()

const featureSchema = computed(() => featureSchemaOf(props.schema))
const tools = computed(() => drawTools(featureSchema.value.geometryTypes))

const format = new GeoJSON({ dataProjection: 'EPSG:4326', featureProjection: 'EPSG:3857' })
const source = new VectorSource<Feature<Geometry>>()
const areaSource = new VectorSource<Feature<Geometry>>()

// Bumped on every change, so counts and the property panel follow the map.
const version = ref(0)
const invalid = ref(false)

const hasProblem = (f: Feature<Geometry>) => featureSchema.value.properties.some(p => propertyProblem(p, f.get(p.name)))

const BASE = '#ea580c'
const PROBLEM = '#dc2626'
const SELECTED = '#2563eb'
function styleFor(color: string, width = 1.5) {
  return new Style({
    stroke: new Stroke({ color, width }),
    fill: new Fill({ color: `${color}33` }),
    image: new Circle({ radius: 5, fill: new Fill({ color }), stroke: new Stroke({ color: '#fff', width: 1.5 }) }),
  })
}
const baseStyle = styleFor(BASE)
const problemStyle = styleFor(PROBLEM, 2)
const selectedStyle = styleFor(SELECTED, 3)
const areaStyle = new Style({ stroke: new Stroke({ color: '#334155', width: 2, lineDash: [6, 4] }) })

// The value last sent up, so an echo of our own change does not reload the map.
let lastEmitted: string | null = null

function emitValue() {
  const collection = format.writeFeaturesObject(source.getFeatures(), { decimals: 6 })
  for (const f of collection.features) {
    if (f.geometry) f.geometry = fitGeometryType(f.geometry as { type: string, coordinates: unknown }, featureSchema.value.geometryTypes) as typeof f.geometry
  }
  lastEmitted = JSON.stringify(collection)
  version.value++
  emit('update:modelValue', lastEmitted)
}

function loadValue(text: string) {
  select?.getFeatures().clear()
  source.clear(true)
  const parsed = parseFeatureCollection(text)
  invalid.value = parsed === null
  if (parsed) {
    try {
      source.addFeatures(format.readFeatures(parsed) as Feature<Geometry>[])
    }
    catch {
      invalid.value = true
    }
  }
  version.value++
  fit()
}

function loadArea(text?: string) {
  areaSource.clear(true)
  if (!text) return
  try {
    areaSource.addFeature(format.readFeature({ type: 'Feature', geometry: JSON.parse(text), properties: {} }) as Feature<Geometry>)
  }
  catch {
    // no area yet
  }
}

function fit() {
  const target = source.getFeatures().length ? source : areaSource
  const extent = target.getExtent()
  if (!map || !extent || !target.getFeatures().length || !Number.isFinite(extent[0])) return
  map.getView().fit(extent, { padding: [32, 32, 32, 32], maxZoom: 18 })
}

watch(() => props.modelValue, (v) => {
  if (v !== lastEmitted) {
    lastEmitted = v
    loadValue(v)
  }
})
watch(() => props.area, (a) => {
  loadArea(a)
  if (!source.getFeatures().length) fit()
})

const mapContainer = ref<HTMLDivElement | null>(null)
let map: Map | undefined
let select: Select | undefined
let draw: Draw | undefined
let observer: ResizeObserver | undefined
const selected = shallowRef<Feature<Geometry>[]>([])
const mode = ref<'select' | DrawTool>('select')

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
  map.addLayer(new VectorLayer({ source: areaSource, style: areaStyle }))
  const layer = new VectorLayer({ source, style: f => hasProblem(f as Feature<Geometry>) ? problemStyle : baseStyle })
  map.addLayer(layer)

  // Click selects, shift-click adds; the selected features can be reshaped and moved.
  select = new Select({ layers: [layer], style: selectedStyle, hitTolerance: 4 })
  select.on('select', () => { selected.value = [...select!.getFeatures().getArray()] })
  map.addInteraction(select)
  const modify = new Modify({ features: select.getFeatures() })
  modify.on('modifyend', emitValue)
  map.addInteraction(modify)
  const translate = new Translate({ features: select.getFeatures() })
  translate.on('translateend', emitValue)
  map.addInteraction(translate)

  loadArea(props.area)
  lastEmitted = props.modelValue
  loadValue(props.modelValue)

  observer = new ResizeObserver(() => map?.updateSize())
  observer.observe(el.parentElement ?? el)
}

// Drawing: one tool at a time; a new feature gets the schema's defaults and is selected,
// so its properties can be filled in right away.
watch(mode, (m) => {
  if (!map) return
  if (draw) map.removeInteraction(draw)
  draw = undefined
  select?.setActive(m === 'select')
  if (m === 'select') return
  draw = new Draw({ source, type: m, style: selectedStyle })
  draw.on('drawend', (e) => {
    const f = e.feature as Feature<Geometry>
    for (const p of featureSchema.value.properties) if (p.default !== undefined) f.set(p.name, p.default)
    setTimeout(() => {
      mode.value = 'select'
      select?.getFeatures().clear()
      select?.getFeatures().push(f)
      selected.value = [f]
      emitValue()
    })
  })
  map.addInteraction(draw)
})

function removeSelected() {
  for (const f of selected.value) source.removeFeature(f)
  select?.getFeatures().clear()
  selected.value = []
  emitValue()
}

function removeAll() {
  select?.getFeatures().clear()
  selected.value = []
  source.clear()
  emitValue()
}

// Property panel: the values of the selection; with several features selected, a
// change applies to all of them and differing values show as empty.
function shownValue(p: FeatureProperty): string {
  void version.value
  const values = [...new Set(selected.value.map(f => f.get(p.name)))]
  return values.length === 1 && values[0] !== undefined && values[0] !== null ? String(values[0]) : ''
}
function setValue(p: FeatureProperty, text: string) {
  const v = propertyValue(p, text)
  for (const f of selected.value) f.set(p.name, v)
  emitValue()
}
function problemOf(p: FeatureProperty): string | null {
  void version.value
  const problem = selected.value.map(f => propertyProblem(p, f.get(p.name))).find(Boolean)
  if (!problem) return null
  const limit = problem === 'min' ? (p.exclusiveMinimum ?? p.minimum) : problem === 'max' ? (p.exclusiveMaximum ?? p.maximum) : undefined
  return t(`features.problem.${problem}`, { limit })
}
const otherProperties = computed(() => {
  void version.value
  if (selected.value.length !== 1) return []
  const named = new Set(featureSchema.value.properties.map(p => p.name))
  return Object.entries(selected.value[0]!.getProperties())
    .filter(([k, v]) => k !== 'geometry' && !named.has(k) && v !== undefined && v !== null && typeof v !== 'object')
})

const count = computed(() => {
  void version.value
  return source.getFeatures().length
})
const problems = computed(() => {
  void version.value
  return source.getFeatures().filter(hasProblem).length
})

const toolIcon: Record<DrawTool, string> = { Polygon: 'i-lucide-pentagon', LineString: 'i-lucide-spline', Point: 'i-lucide-map-pin' }

// The raw JSON, for pasting a collection from elsewhere.
const showJson = ref(false)
const jsonText = ref('')
watch(showJson, (open) => { if (open) jsonText.value = props.modelValue })
function applyJson() {
  lastEmitted = null
  emit('update:modelValue', jsonText.value)
  showJson.value = false
}
</script>

<template>
  <div class="space-y-2">
    <div class="flex flex-wrap items-center gap-2">
      <UFieldGroup size="sm">
        <UButton
          type="button"
          icon="i-lucide-mouse-pointer-2"
          :color="mode === 'select' ? 'primary' : 'neutral'"
          :variant="mode === 'select' ? 'solid' : 'outline'"
          :aria-label="t('features.select')"
          :aria-pressed="mode === 'select'"
          @click="() => { mode = 'select' }"
        >
          <span class="hidden sm:inline">{{ t('features.select') }}</span>
        </UButton>
        <UButton
          v-for="tool in tools"
          :key="tool"
          type="button"
          :icon="toolIcon[tool]"
          :color="mode === tool ? 'primary' : 'neutral'"
          :variant="mode === tool ? 'solid' : 'outline'"
          :aria-label="t(`features.draw.${tool}`)"
          :aria-pressed="mode === tool"
          @click="() => { mode = tool }"
        >
          <span class="hidden sm:inline">{{ t(`features.draw.${tool}`) }}</span>
        </UButton>
      </UFieldGroup>
      <UButton type="button" size="sm" color="neutral" variant="outline" icon="i-lucide-trash-2" :disabled="!selected.length" @click="removeSelected">
        {{ t('features.remove', { n: selected.length }) }}
      </UButton>
      <UButton type="button" size="sm" color="neutral" variant="ghost" icon="i-lucide-braces" class="ml-auto" :aria-pressed="showJson" @click="() => { showJson = !showJson }">
        JSON
      </UButton>
    </div>

    <div class="h-96 w-full overflow-hidden rounded-lg border border-(--ui-border)">
      <div ref="mapContainer" class="h-full w-full" />
    </div>

    <div class="flex flex-wrap items-center justify-between gap-2 text-xs text-(--ui-text-muted)">
      <span>
        {{ mode === 'select' ? t('features.hintSelect') : t(`features.hintDraw.${mode}`) }}
        · {{ t('features.count', { n: count }) }}
        <span v-if="problems" class="text-red-600">· {{ t('features.problems', { n: problems }) }}</span>
      </span>
      <UButton v-if="count" type="button" size="xs" variant="ghost" color="neutral" @click="removeAll">
        {{ t('features.removeAll') }}
      </UButton>
    </div>
    <p v-if="invalid" class="text-xs text-red-600">
      {{ t('features.invalid') }}
    </p>

    <!-- Properties of the selection. -->
    <div v-if="selected.length && featureSchema.properties.length" class="space-y-3 rounded-lg border border-(--ui-border) bg-white p-4">
      <p class="text-sm font-medium">
        {{ selected.length === 1 ? t('features.propertiesOne') : t('features.propertiesMany', { n: selected.length }) }}
      </p>
      <div class="grid gap-3 sm:grid-cols-2">
        <UFormField
          v-for="p in featureSchema.properties"
          :key="p.name"
          :label="p.name"
          :required="p.required"
          :help="p.description"
          :error="problemOf(p) ?? undefined"
        >
          <USelect
            v-if="p.enum || p.type === 'boolean'"
            :model-value="shownValue(p)"
            :items="(p.enum ?? [true, false]).map(v => ({ label: String(v), value: String(v) }))"
            class="w-full"
            @update:model-value="(v: string) => setValue(p, v)"
          />
          <UInput
            v-else
            :model-value="shownValue(p)"
            :type="p.type === 'number' || p.type === 'integer' ? 'number' : 'text'"
            step="any"
            :placeholder="selected.length > 1 ? t('features.mixed') : undefined"
            class="w-full"
            @change="(e: Event) => setValue(p, (e.target as HTMLInputElement).value)"
          />
        </UFormField>
      </div>
      <p v-if="otherProperties.length" class="text-xs break-all text-(--ui-text-muted)">
        {{ otherProperties.map(([k, v]) => `${k}: ${v}`).join(' · ') }}
      </p>
    </div>

    <div v-if="showJson" class="space-y-2">
      <UTextarea v-model="jsonText" :rows="6" class="w-full font-mono text-xs" />
      <div class="flex justify-end gap-2">
        <UButton type="button" size="sm" color="neutral" variant="ghost" @click="() => { showJson = false }">
          {{ t('features.cancel') }}
        </UButton>
        <UButton type="button" size="sm" @click="applyJson">
          {{ t('features.applyJson') }}
        </UButton>
      </div>
    </div>
  </div>
</template>
