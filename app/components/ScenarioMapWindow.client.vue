<script setup lang="ts">
import { createMap } from '@masterportal/masterportalapi/src/maps/ol/olMap.js'
import type Feature from 'ol/Feature'
import GeoJSON from 'ol/format/GeoJSON'
import type { Geometry } from 'ol/geom'
import { Draw, Modify, Select, Translate } from 'ol/interaction'
import TileLayer from 'ol/layer/Tile'
import VectorLayer from 'ol/layer/Vector'
import type Map from 'ol/Map'
import { transformExtent } from 'ol/proj'
import OSM from 'ol/source/OSM'
import VectorSource from 'ol/source/Vector'
import { Circle, Fill, Stroke, Style } from 'ol/style'
import 'ol/ol.css'
import type { ProcessInput } from '~/types/ump'
import type { DrawTool, FeatureProperty, FeatureSchema } from '~/utils/featureCollection'
import type { GeometryType } from '~/utils/geometryInput'

// One map for all map inputs of a model (design idea from the team: not one map per
// input): the area, buildings, trees, land cover … each as a layer. One layer is edited
// at a time, the others stay visible but faded, so trees are placed between the
// buildings. What can be drawn and which properties a feature has come from each input's
// schema (geometryInput.ts, featureCollection.ts). Every change goes straight into the
// form values, as JSON text like any other field.
const props = defineProps<{ inputs: ProcessInput[], extent?: string, titles: Record<string, string> }>()
const open = defineModel<boolean>('open', { required: true })
const active = defineModel<string>('active', { required: true })
const values = defineModel<Record<string, string>>('values', { required: true })
const { t, locale } = useI18n()

const format = new GeoJSON({ dataProjection: 'EPSG:4326', featureProjection: 'EPSG:3857' })

interface EditLayer {
  input: ProcessInput
  kind: 'geometry' | 'features'
  source: VectorSource<Feature<Geometry>>
  layer: VectorLayer<VectorSource<Feature<Geometry>>>
  types: GeometryType[]
  tools: DrawTool[]
  schema: FeatureSchema | null
}

const COLORS = ['#ea580c', '#16a34a', '#9333ea', '#0891b2']
const AREA = '#2563eb'
const PROBLEM = '#dc2626'
const SELECTED = '#1d4ed8'
function styleFor(color: string, width = 1.5, fill = 0.2) {
  const alpha = Math.round(fill * 255).toString(16).padStart(2, '0')
  return new Style({
    stroke: new Stroke({ color, width }),
    fill: new Fill({ color: `${color}${alpha}` }),
    image: new Circle({ radius: 5, fill: new Fill({ color }), stroke: new Stroke({ color: '#fff', width: 1.5 }) }),
  })
}
const problemStyle = styleFor(PROBLEM, 2)
const selectedStyle = styleFor(SELECTED, 3, 0.3)
const extentStyle = new Style({ stroke: new Stroke({ color: '#64748b', width: 1.5, lineDash: [4, 4] }) })

// Bumped on every change, so counts and the property panel follow the map.
const version = ref(0)
const layers = shallowRef<EditLayer[]>([])
const current = computed(() => layers.value.find(l => l.input.name === active.value) ?? layers.value[0])

const hasProblem = (l: EditLayer, f: Feature<Geometry>) => !!l.schema?.properties.some(p => propertyProblem(p, f.get(p.name)))

// The text last written per input, so an echo of our own change does not reload a layer.
const lastWritten: Record<string, string> = {}

function write(l: EditLayer) {
  const name = l.input.name
  let text = ''
  if (l.kind === 'geometry') {
    const geometry = combineGeometries(l.source.getFeatures().map(f => format.writeGeometryObject(f.getGeometry()!, { decimals: 6 })), l.types)
    text = geometry ? JSON.stringify(geometry) : ''
  }
  else {
    const collection = format.writeFeaturesObject(l.source.getFeatures(), { decimals: 6 })
    for (const f of collection.features) {
      if (f.geometry) f.geometry = fitGeometryType(f.geometry as { type: string, coordinates: unknown }, l.types) as typeof f.geometry
    }
    text = l.source.getFeatures().length ? JSON.stringify(collection) : ''
  }
  lastWritten[name] = text
  values.value = { ...values.value, [name]: text }
  version.value++
}

function load(l: EditLayer, text: string) {
  l.source.clear(true)
  lastWritten[l.input.name] = text
  try {
    if (l.kind === 'geometry') {
      const kind = drawKind(l.types)
      for (const part of text ? partsOf(JSON.parse(text), kind) : []) {
        l.source.addFeature(format.readFeature({ type: 'Feature', geometry: { type: kind, coordinates: part }, properties: {} }) as Feature<Geometry>)
      }
    }
    else {
      const collection = parseFeatureCollection(text)
      if (collection) l.source.addFeatures(format.readFeatures(collection) as Feature<Geometry>[])
    }
  }
  catch {
    // Not valid here; the form marks the field.
  }
  version.value++
}

// Values changed outside the map (e.g. "load status quo") reload their layer.
watch(values, (v) => {
  for (const l of layers.value) {
    const text = v[l.input.name] ?? ''
    if (text !== lastWritten[l.input.name]) load(l, text)
  }
})

const mapContainer = ref<HTMLDivElement | null>(null)
let map: Map | undefined
let observer: ResizeObserver | undefined
let interactions: (Select | Modify | Translate | Draw)[] = []
let select: Select | undefined
const extentSource = new VectorSource<Feature<Geometry>>()
const selected = shallowRef<Feature<Geometry>[]>([])
const mode = ref<'select' | DrawTool>('select')

watch(mapContainer, (el) => {
  if (el && !map) buildMap(el)
}, { flush: 'post' })

// Without an area nothing else can be loaded, and a shape drawn on another layer would
// become a building or a tree: open on the first empty required area input.
watch(open, (o) => {
  if (o) {
    const missing = props.inputs.find(inp => inputKind(inp) === 'geometry' && inp.required && !values.value[inp.name])
    if (missing) active.value = missing.name
    return
  }
  observer?.disconnect()
  map?.setTarget(undefined)
  map = undefined
  layers.value = []
  selected.value = []
  mode.value = 'select'
})
onBeforeUnmount(() => {
  observer?.disconnect()
  map?.setTarget(undefined)
})

function buildMap(el: HTMLDivElement) {
  map = createMap({ ...useMapConfig(), target: el }) as Map
  map.addLayer(new TileLayer({ source: new OSM() }))
  map.addLayer(new VectorLayer({ source: extentSource, style: extentStyle }))
  extentSource.clear(true)
  if (props.extent) {
    try {
      extentSource.addFeature(format.readFeature({ type: 'Feature', geometry: JSON.parse(props.extent), properties: {} }) as Feature<Geometry>)
    }
    catch {
      // no extent
    }
  }

  // The area last, so it is drawn on top of the buildings it encloses.
  const ordered = [...props.inputs].sort((a, b) => Number(inputKind(a) === 'geometry') - Number(inputKind(b) === 'geometry'))
  let colour = 0
  layers.value = ordered.map((input) => {
    const kind = inputKind(input) === 'geometry' ? 'geometry' as const : 'features' as const
    const schema = kind === 'features' ? featureSchemaOf(input.schema) : null
    const types = kind === 'features' ? schema!.geometryTypes : allowedGeometryTypes(input.schema)
    const tools = kind === 'features' ? drawTools(types) : [drawKind(types)]
    const base = kind === 'geometry' ? styleFor(AREA, 2, 0.1) : styleFor(COLORS[colour++ % COLORS.length]!)
    const source = new VectorSource<Feature<Geometry>>()
    const l: EditLayer = { input, kind, source, types, tools, schema, layer: undefined as never }
    l.layer = new VectorLayer({ source, style: f => hasProblem(l, f as Feature<Geometry>) ? problemStyle : base })
    map!.addLayer(l.layer)
    load(l, values.value[input.name] ?? '')
    return l
  })
  activate()
  fit()

  // The map gets its final size only once the window has opened.
  observer = new ResizeObserver(() => {
    map?.updateSize()
  })
  observer.observe(el)
  setTimeout(() => {
    map?.updateSize()
    fit()
  }, 250)
}

function fit() {
  const l = current.value
  const target = [l?.source, ...layers.value.filter(x => x.kind === 'geometry').map(x => x.source), extentSource]
    .find(s => s?.getFeatures().length)
  const extent = target?.getExtent()
  if (!map || !extent || !Number.isFinite(extent[0])) return
  map.getView().fit(extent, { padding: [48, 48, 48, 48], maxZoom: 18 })
}

// Interactions belong to the layer being edited; the others are faded and inert.
function activate() {
  if (!map) return
  for (const i of interactions) map.removeInteraction(i)
  interactions = []
  selected.value = []
  const l = current.value
  for (const x of layers.value) x.layer.setOpacity(x === l ? 1 : 0.4)
  if (!l) return

  if (mode.value === 'select') {
    select = new Select({ layers: [l.layer], style: selectedStyle, hitTolerance: 4 })
    select.on('select', () => { selected.value = [...select!.getFeatures().getArray()] })
    const modify = new Modify({ features: select.getFeatures() })
    modify.on('modifyend', () => write(l))
    const translate = new Translate({ features: select.getFeatures() })
    translate.on('translateend', () => write(l))
    interactions = [select, modify, translate]
  }
  else {
    select = undefined
    const draw = new Draw({ source: l.source, type: mode.value, style: selectedStyle })
    // An area without Multi* is one shape: a new one replaces the old.
    draw.on('drawstart', () => {
      if (l.kind === 'geometry' && !allowsMany(l.types, drawKind(l.types))) l.source.clear()
    })
    draw.on('drawend', (e) => {
      const f = e.feature as Feature<Geometry>
      for (const p of l.schema?.properties ?? []) if (p.default !== undefined) f.set(p.name, p.default)
      setTimeout(async () => {
        write(l)
        mode.value = 'select'
        await nextTick()
        select?.getFeatures().push(f)
        selected.value = [f]
      })
    })
    interactions = [draw]
  }
  for (const i of interactions) map.addInteraction(i)
}

watch(active, () => {
  mode.value = 'select'
  activate()
})
watch(mode, activate)

function removeSelected() {
  const l = current.value
  if (!l) return
  for (const f of selected.value) l.source.removeFeature(f)
  select?.getFeatures().clear()
  selected.value = []
  write(l)
}
function removeAll() {
  const l = current.value
  if (!l) return
  select?.getFeatures().clear()
  selected.value = []
  l.source.clear()
  write(l)
}

// Property panel of the selection; with several features a change applies to all.
function shownValue(p: FeatureProperty): string {
  void version.value
  const vals = [...new Set(selected.value.map(f => f.get(p.name)))]
  return vals.length === 1 && vals[0] !== undefined && vals[0] !== null ? String(vals[0]) : ''
}
function setValue(p: FeatureProperty, text: string) {
  const v = propertyValue(p, text)
  for (const f of selected.value) f.set(p.name, v)
  if (current.value) write(current.value)
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
  const l = current.value
  if (selected.value.length !== 1 || !l?.schema) return []
  const named = new Set(l.schema.properties.map(p => p.name))
  return Object.entries(selected.value[0]!.getProperties())
    .filter(([k, v]) => k !== 'geometry' && !named.has(k) && v !== undefined && v !== null && typeof v !== 'object')
})

const tabs = computed(() => {
  void version.value
  return layers.value.map(l => ({
    value: l.input.name,
    label: `${l.input.title}${l.input.required ? ' *' : ''} · ${l.source.getFeatures().length}`,
  }))
})
const count = computed(() => {
  void version.value
  return current.value?.source.getFeatures().length ?? 0
})
const problems = computed(() => {
  void version.value
  const l = current.value
  return l ? l.source.getFeatures().filter(f => hasProblem(l, f)).length : 0
})

// Drawing tools name their layer ("Draw Buildings"), so nobody draws a building while
// meaning the area; with several tools the geometry follows ("Trees: point").
function drawLabel(tool: DrawTool): string {
  const l = current.value
  if (!l) return t(`features.draw.${tool}`)
  return l.tools.length > 1
    ? t('scenarioMap.drawKind', { layer: l.input.title, kind: t(`features.draw.${tool}`) })
    : t('scenarioMap.draw', { layer: l.input.title })
}

const toolIcon: Record<DrawTool, string> = { Polygon: 'i-lucide-pentagon', LineString: 'i-lucide-spline', Point: 'i-lucide-map-pin' }

// "Load status quo" of the active layer, writing straight into the form values.
const activeValue = computed({
  get: () => values.value[active.value] ?? '',
  set: (v: string) => { values.value = { ...values.value, [active.value]: v } },
})

// Place search, as on the single area map.
interface Place { display_name: string, boundingbox: [string, string, string, string] }
const query = ref('')
const places = ref<Place[]>([])
const searching = ref(false)
async function search() {
  const q = query.value.trim()
  if (!q) return
  searching.value = true
  try {
    places.value = await $fetch<Place[]>('https://nominatim.openstreetmap.org/search', {
      query: { q, format: 'jsonv2', limit: 5 },
      headers: { 'accept-language': locale.value },
    })
  }
  catch {
    places.value = []
  }
  finally {
    searching.value = false
  }
}
function goTo(p: Place) {
  const [south, north, west, east] = p.boundingbox.map(Number) as [number, number, number, number]
  map?.getView().fit(transformExtent([west, south, east, north], 'EPSG:4326', 'EPSG:3857'), { padding: [16, 16, 16, 16], maxZoom: 17 })
  places.value = []
}
</script>

<template>
  <UModal v-model:open="open" fullscreen :title="t('scenarioMap.title')" :description="t('scenarioMap.intro')">
    <template #body>
      <div class="flex h-full min-h-0 flex-col gap-3">
        <div class="flex flex-wrap items-center gap-2">
          <span class="text-sm font-medium">{{ t('scenarioMap.layer') }}</span>
          <UTabs v-model="active" :items="tabs" :content="false" variant="pill" />
          <div class="ml-auto flex gap-2">
            <UInput v-model="query" icon="i-lucide-search" :placeholder="t('geometry.search')" size="sm" class="w-56" @keydown.enter.prevent="search" />
            <UButton type="button" size="sm" variant="subtle" :loading="searching" @click="search">
              {{ t('geometry.searchButton') }}
            </UButton>
          </div>
        </div>
        <ul v-if="places.length" class="divide-y divide-(--ui-border) rounded-md border border-(--ui-border) bg-white text-sm">
          <li v-for="p in places" :key="p.display_name">
            <button type="button" class="w-full px-3 py-1.5 text-left hover:bg-(--ui-bg-elevated)" @click="goTo(p)">
              {{ p.display_name }}
            </button>
          </li>
        </ul>

        <div v-if="current" class="flex flex-wrap items-center gap-2">
          <UFieldGroup size="sm">
            <UButton
              type="button"
              icon="i-lucide-mouse-pointer-2"
              :color="mode === 'select' ? 'primary' : 'neutral'"
              :variant="mode === 'select' ? 'solid' : 'outline'"
              :aria-pressed="mode === 'select'"
              @click="() => { mode = 'select' }"
            >
              {{ t('features.select') }}
            </UButton>
            <UButton
              v-for="tool in current.tools"
              :key="tool"
              type="button"
              :icon="toolIcon[tool]"
              :color="mode === tool ? 'primary' : 'neutral'"
              :variant="mode === tool ? 'solid' : 'outline'"
              :aria-pressed="mode === tool"
              @click="() => { mode = tool }"
            >
              {{ drawLabel(tool) }}
            </UButton>
          </UFieldGroup>
          <UButton type="button" size="sm" color="neutral" variant="outline" icon="i-lucide-trash-2" :disabled="!selected.length" @click="removeSelected">
            {{ t('features.remove', { n: selected.length }) }}
          </UButton>
          <SourceCollectionLoad
            v-if="current.input.source"
            :key="current.input.name"
            v-model="activeValue"
            :source="current.input.source"
            :values="values"
            :titles="titles"
          />
          <span class="ml-auto text-xs text-(--ui-text-muted)">
            {{ t('features.count', { n: count }) }}
            <span v-if="problems" class="text-red-600">· {{ t('features.problems', { n: problems }) }}</span>
          </span>
          <UButton v-if="count" type="button" size="xs" variant="ghost" color="neutral" @click="removeAll">
            {{ t('features.removeAll') }}
          </UButton>
        </div>

        <div class="relative min-h-80 flex-1 overflow-hidden rounded-lg border border-(--ui-border)">
          <div ref="mapContainer" class="absolute inset-0" />
        </div>
        <p class="text-xs text-(--ui-text-muted)">
          <span v-if="current" class="font-medium">{{ t('scenarioMap.editing', { layer: current.input.title }) }}</span>
          {{ mode === 'select' ? t('features.hintSelect') : t(`features.hintDraw.${mode}`) }}
        </p>

        <div v-if="selected.length && current?.schema?.properties.length" class="space-y-3 rounded-lg border border-(--ui-border) bg-white p-4">
          <p class="text-sm font-medium">
            {{ selected.length === 1 ? t('features.propertiesOne') : t('features.propertiesMany', { n: selected.length }) }}
          </p>
          <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <UFormField
              v-for="p in current.schema.properties"
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
      </div>
    </template>
    <template #footer>
      <div class="flex w-full justify-end">
        <UButton @click="() => { open = false }">
          {{ t('scenarioMap.done') }}
        </UButton>
      </div>
    </template>
  </UModal>
</template>
