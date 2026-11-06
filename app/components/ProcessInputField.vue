<script setup lang="ts">
import type { ProcessInput } from '~/types/ump'

// One input of the run form. Which field it gets follows the schema (see
// app/utils/inputKinds.ts). The value is always text, as the form keeps it; the
// conversion to numbers, booleans and objects happens once, in cleanInputs.
// `extent`: the data area of the chosen city (GeoJSON geometry), where the map of a
// "name or area" input opens. Area and feature inputs are edited in the shared map
// window (ScenarioMapWindow); here they show a summary and a button that asks for it.
const props = defineProps<{ input: ProcessInput, problem: string | null, extent?: string }>()
const emit = defineEmits<{ openMap: [name: string] }>()
const value = defineModel<string>({ required: true })

const { t, locale } = useI18n()

const kind = computed(() => inputKind(props.input))
const choices = computed(() => choicesOf(props.input.schema).map(String))

// Select items cannot carry an empty value, so "nothing chosen" and "a date" get
// placeholders that map back to the form's text.
const NONE = '__none__'
const DATE = '__date__'
const items = computed(() => [
  ...(props.input.required ? [] : [{ label: t('run.field.none'), value: NONE }]),
  ...choices.value.map(c => ({ label: c, value: c })),
  ...(kind.value === 'choiceOrDate' ? [{ label: t('run.field.pickDate'), value: DATE }] : []),
])

// For a choice-or-date input: whether the date field is shown. Starts in date mode if
// the current value is not one of the choices.
const dateMode = ref(kind.value === 'choiceOrDate' && value.value !== '' && !choices.value.includes(value.value))
const selected = computed({
  get: () => dateMode.value ? DATE : (value.value === '' ? NONE : value.value),
  set: (v: string) => {
    dateMode.value = v === DATE
    value.value = v === NONE || v === DATE ? '' : v
  },
})

// For a name-or-geometry input: whether the map is shown. Starts on the map if the
// current value is a geometry; switching clears the value, since a name and a drawing
// cannot both be sent.
const geometry = computed(() => geometryBranch(props.input.schema) ?? undefined)
const mapMode = ref(kind.value === 'textOrGeometry' && looksLikeGeometry(value.value))
const modes = computed(() => [
  { label: t('run.field.byName'), value: 'text' },
  { label: t('run.field.onMap'), value: 'map' },
])
// Short summary of an area or feature input: area in km² or number of features. Invalid
// features are reported below the field like any other problem.
const parsedFeatures = computed(() => kind.value === 'features' ? parseFeatureCollection(value.value) : null)
const summary = computed(() => {
  if (!value.value) return ''
  if (kind.value === 'geometry') {
    try {
      const km2 = geometryAreaKm2(JSON.parse(value.value))
      return km2 ? t('scenarioMap.areaSummary', { km2: km2.toLocaleString(locale.value, { maximumFractionDigits: 2 }) }) : t('scenarioMap.drawn')
    }
    catch {
      return ''
    }
  }
  return parsedFeatures.value ? t('features.count', { n: parsedFeatures.value.features.length }) : ''
})

const mode = computed({
  get: () => mapMode.value ? 'map' : 'text',
  set: (m: string) => {
    if ((m === 'map') === mapMode.value) return
    mapMode.value = m === 'map'
    value.value = ''
  },
})
</script>

<template>
  <div class="space-y-1">
    <div class="flex items-center gap-1">
      <label :for="`in-${input.name}`" class="text-sm font-medium">
        {{ input.title }}
        <span v-if="input.required" class="text-(--ui-error)">*</span>
      </label>
      <!-- The description opens on click (a hover tooltip does not work on touch). -->
      <UPopover v-if="input.description" :content="{ side: 'top', align: 'start' }">
        <UButton
          icon="i-lucide-info"
          color="neutral"
          variant="ghost"
          size="xs"
          :aria-label="t('run.field.info', { name: input.title })"
          class="text-(--ui-text-muted)"
        />
        <template #content>
          <p class="max-w-xs p-3 text-sm">
            {{ input.description }}
          </p>
        </template>
      </UPopover>
    </div>

    <!-- Yes/no as a switch; stored as "true"/"false". -->
    <div v-if="kind === 'boolean'">
      <USwitch
        :id="`in-${input.name}`"
        :model-value="value === 'true'"
        @update:model-value="on => { value = on ? 'true' : 'false' }"
      />
    </div>

    <div v-else-if="kind === 'geometry' || kind === 'features'" class="flex flex-wrap items-center gap-3 rounded-md border border-(--ui-border) bg-white px-3 py-2">
      <UIcon :name="kind === 'geometry' ? 'i-lucide-square-dashed' : 'i-lucide-layers'" class="size-4 text-(--ui-text-muted)" aria-hidden="true" />
      <span class="text-sm" :class="summary ? '' : 'text-(--ui-text-muted)'">
        {{ summary || t('scenarioMap.empty') }}
      </span>
      <UButton :id="`in-${input.name}`" type="button" size="sm" color="neutral" variant="outline" icon="i-lucide-map" class="ml-auto" @click="emit('openMap', input.name)">
        {{ t('scenarioMap.open') }}
      </UButton>
    </div>

    <div v-else-if="kind === 'textOrGeometry'" class="space-y-2">
      <URadioGroup v-model="mode" :items="modes" orientation="horizontal" :aria-label="input.title" />
      <GeometryInput v-if="mapMode" v-model="value" :schema="geometry" :extent="extent" />
      <UInput
        v-else
        :id="`in-${input.name}`"
        v-model="value"
        :color="problem ? 'error' : undefined"
        :highlight="!!problem"
        class="w-full"
      />
    </div>

    <div v-else-if="kind === 'choice' || kind === 'choiceOrDate'" class="flex flex-wrap gap-2">
      <USelect
        :id="`in-${input.name}`"
        v-model="selected"
        :items="items"
        :color="problem ? 'error' : undefined"
        :highlight="!!problem"
        class="min-w-48"
      />
      <UInput v-if="dateMode" v-model="value" type="date" :color="problem ? 'error' : undefined" :highlight="!!problem" />
    </div>

    <UInput
      v-else
      :id="`in-${input.name}`"
      v-model="value"
      :type="kind === 'number' ? 'number' : kind === 'date' ? 'date' : 'text'"
      :color="problem ? 'error' : undefined"
      :highlight="!!problem"
      class="w-full"
    />

    <p v-if="problem" class="text-xs text-red-600">
      {{ problem }}
    </p>
    <slot />
  </div>
</template>
