<script setup lang="ts">
import type { ProcessInput } from '~/types/ump'

// One input of the run form. Which field it gets follows the schema (see
// app/utils/inputKinds.ts). The value is always text, as the form keeps it; the
// conversion to numbers, booleans and objects happens once, in cleanInputs.
const props = defineProps<{ input: ProcessInput, problem: string | null }>()
const value = defineModel<string>({ required: true })

const { t } = useI18n()

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
</script>

<template>
  <div class="space-y-1">
    <label :for="`in-${input.name}`" class="text-sm font-medium">
      {{ input.title }}
      <span v-if="input.required" class="text-(--ui-error)">*</span>
    </label>

    <!-- Yes/no as a switch; stored as "true"/"false". -->
    <div v-if="kind === 'boolean'">
      <USwitch
        :id="`in-${input.name}`"
        :model-value="value === 'true'"
        @update:model-value="on => { value = on ? 'true' : 'false' }"
      />
    </div>

    <GeometryInput v-else-if="kind === 'geometry'" v-model="value" :schema="input.schema" />

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
      :placeholder="input.description"
      :color="problem ? 'error' : undefined"
      :highlight="!!problem"
      class="w-full"
    />

    <!-- Fields without a placeholder show the description below. -->
    <p v-if="input.description && kind !== 'text' && kind !== 'number'" class="text-xs text-(--ui-text-dimmed)">
      {{ input.description }}
    </p>
    <p v-if="problem" class="text-xs text-red-600">
      {{ problem }}
    </p>
    <slot />
  </div>
</template>
