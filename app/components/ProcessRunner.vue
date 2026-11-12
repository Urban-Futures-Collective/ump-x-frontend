<script setup lang="ts">
import type { ResultLayer } from '~/types/ump'

const props = defineProps<{ processId: string }>()
const emit = defineEmits<{ result: [ResultLayer | null] }>()

const { t } = useI18n()
// Awaited so the form already carries its values during SSR. Without await the
// watch below ran on the server before the detail arrived, server and client
// rendered different values and every field hit a hydration mismatch.
const { data: proc, pending: loadingProc, error: procError } = await useUmpProcess(() => props.processId)
const { run, jobId, status, progress, error, result, running, slow } = useUmpRun()

// Whether this account may start a run, from the model card (readable without sign-in)
// and the session roles. Locked does not hide the form: it shows what the model takes,
// only starting is closed, with the reason next to it instead of an error after the click.
const { loggedIn, login } = useOidcAuth()
const { roles } = useUmpRoles()
const { cards } = useCommonsCards()
const access = computed(() => runAccess(cards.value.get(props.processId), loggedIn.value, roles.value))
const locked = computed(() => access.value === 'login' || access.value === 'locked')

// A job that fails without a message only yields its status as a key, a
// response without a body only its HTTP status. Translate those two; anything
// else is already text from UMP or the model.
const errorText = computed(() => {
  const e = error.value
  if (!e) return null
  if (e.startsWith('job.')) return t(`run.${e}`)
  const http = /^http\.(\d+)$/.exec(e)
  if (http) {
    const status = Number(http[1])
    return t(status >= 500 ? 'run.http.server' : 'run.http.rejected', { status })
  }
  return e
})

// Initialise the form with defaults once the process detail has loaded.
//
// Query values (`?in.<name>=...`) override the defaults. The chat uses this to
// hand over a prepared run: it proposes, the URL carries the proposal, and the
// user submits here by hand. A deep link rather than shared state, so the
// proposal survives a reload and can be shared.
const route = useRoute()

function initialValues(p: typeof proc.value): Record<string, string> {
  const next: Record<string, string> = {}
  for (const inp of p?.inputs ?? []) {
    const fromQuery = route.query[`in.${inp.name}`]
    next[inp.name] = typeof fromQuery === 'string' && fromQuery !== ''
      ? fromQuery
      : inp.default != null ? String(inp.default) : ''
  }
  return next
}

const form = ref<Record<string, string>>(initialValues(proc.value))
watch(proc, p => (form.value = initialValues(p)))

// Pass the result up to the map.
watch(result, r => emit('result', r))

// Number inputs cannot show a non-numeric default: the browser drops "auto"
// from a type=number field. The field looks empty and nobody learns that
// leaving it empty is what applies the default, so show a hint below it, but
// only where the default is actually invisible.
function defaultInvisible(inp: { type: string, default?: unknown }) {
  if (inp.default == null) return false
  const isNumberField = inp.type === 'integer' || inp.type === 'number'
  return isNumberField && !Number.isFinite(Number(inp.default))
}

// Rules from the schema, checked before sending. A field shows its problem once it has
// a value; empty required fields only after the first attempt to send, so a fresh
// form is not covered in red.
const attempted = ref(false)
watch(() => props.processId, () => { attempted.value = false })
// Inputs that matter for the current values (`x-ump-relevant-if`). Hidden ones are
// neither checked nor sent.
const visibleInputs = computed(() => (proc.value?.inputs ?? []).filter(inp => isRelevant(inp.relevantIf, form.value)))
// The data area of the chosen city, drawn on the maps and zoomed to (see cityShapeUrl).
const cityUrl = computed(() => cityShapeUrl((proc.value?.inputs ?? []).map(inp => inp.source), form.value.city))
const cityShape = ref<string | undefined>()
watch(cityUrl, async (url) => {
  if (!import.meta.client) return
  cityShape.value = undefined
  if (!url) return
  try {
    const city = await $fetch<{ geometry?: unknown }>(url)
    if (url === cityUrl.value && city?.geometry) cityShape.value = JSON.stringify(city.geometry)
  }
  catch {
    // The maps then start where they always do.
  }
}, { immediate: true })

// Area and feature inputs share one map window (ScenarioMapWindow).
const mapInputs = computed(() => visibleInputs.value.filter(inp => ['geometry', 'features'].includes(inputKind(inp))))
const mapOpen = ref(false)
const mapActive = ref('')
function openMap(name: string) {
  mapActive.value = name
  mapOpen.value = true
}

const inputTitles = computed(() => Object.fromEntries((proc.value?.inputs ?? []).map(inp => [inp.name, inp.title])))
const mainInputs = computed(() => visibleInputs.value.filter(inp => inp.group !== 'advanced'))
const advancedInputs = computed(() => visibleInputs.value.filter(inp => inp.group === 'advanced'))

const problems = computed(() => Object.fromEntries(
  visibleInputs.value.map(inp => [inp.name, inputProblem(inp, form.value[inp.name])]),
))
function shownProblem(name: string) {
  const p = problems.value[name]
  if (!p || (p.key === 'required' && !attempted.value)) return null
  return p.key === 'pattern'
    ? t('run.invalid.pattern', { pattern: p.pattern })
    : t(`run.invalid.${p.key}`, 'limit' in p ? { limit: p.limit } : {})
}

// Advanced settings start collapsed but open when one of them has a problem.
const advancedOpen = ref(false)
watch(attempted, (a) => {
  if (a && advancedInputs.value.some(inp => problems.value[inp.name])) advancedOpen.value = true
})

async function onSubmit() {
  attempted.value = true
  if (Object.values(problems.value).some(Boolean)) return
  // The rule lives in app/utils/processInputs.ts because the chat applies it
  // too; two copies would disagree about the "auto" default.
  await run(props.processId, cleanInputs(visibleInputs.value, form.value))
}
</script>

<template>
  <div class="space-y-4 rounded-lg border border-(--ui-border) p-4">
    <div>
      <h3 class="font-medium">
        {{ proc?.title ?? processId }}
      </h3>
      <p v-if="proc?.description" class="text-sm text-(--ui-text-muted)">
        {{ proc.description }}
      </p>
    </div>

    <!-- Without its description the model has no fields to show; a bare "Run" button
         would only lead to the same failure. UMP answers 404 both for a model that
         does not exist and for one this account may not see. -->
    <p v-if="procError" class="text-sm text-red-600">
      {{ t('run.unavailable') }}
    </p>

    <form v-else class="space-y-3" @submit.prevent="onSubmit">
      <ProcessInputField
        v-for="inp in mainInputs"
        :key="inp.name"
        v-model="form[inp.name]!"
        :input="inp"
        :problem="shownProblem(inp.name)"
        :extent="cityShape"
        @open-map="openMap"
      >
        <p v-if="defaultInvisible(inp)" class="text-xs text-(--ui-text-dimmed)">
          {{ t('run.defaultHint', { value: String(inp.default) }) }}
        </p>
        <SourceCollectionLoad v-if="inp.source" v-model="form[inp.name]!" :source="inp.source" :values="form" :titles="inputTitles" />
      </ProcessInputField>

      <!-- Model settings with sensible defaults (x-ump-group: advanced). -->
      <UCollapsible v-if="advancedInputs.length" v-model:open="advancedOpen" class="space-y-3">
        <UButton
          type="button"
          variant="link"
          color="neutral"
          class="px-0"
          :trailing-icon="advancedOpen ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
        >
          {{ t('run.advanced', { n: advancedInputs.length }) }}
        </UButton>
        <template #content>
          <div class="space-y-3">
            <ProcessInputField
              v-for="inp in advancedInputs"
              :key="inp.name"
              v-model="form[inp.name]!"
              :input="inp"
              :problem="shownProblem(inp.name)"
              :extent="cityShape"
              @open-map="openMap"
            >
              <p v-if="defaultInvisible(inp)" class="text-xs text-(--ui-text-dimmed)">
                {{ t('run.defaultHint', { value: String(inp.default) }) }}
              </p>
              <SourceCollectionLoad v-if="inp.source" v-model="form[inp.name]!" :source="inp.source" :values="form" :titles="inputTitles" />
            </ProcessInputField>
          </div>
        </template>
      </UCollapsible>

      <div class="flex items-center gap-3">
        <UButton type="submit" :loading="running" :disabled="loadingProc || locked" icon="i-lucide-play">
          {{ t('run.execute') }}
        </UButton>
        <JobStatusBadge v-if="status !== 'idle'" :status="status" :progress="progress" />
        <!-- Link to the job so the run can be found again after a reload. -->
        <ULink
          v-if="jobId"
          :to="`/jobs/${jobId}`"
          class="text-sm text-(--ui-text-muted) hover:text-(--ui-text)"
        >
          {{ t('run.openJob') }}
        </ULink>
        <ResultDownload
          v-if="jobId && status === 'successful'"
          :job-id="jobId"
          :process-id="processId"
        />
      </div>

      <div v-if="locked" class="flex gap-3 rounded-lg border border-(--ui-border) bg-(--ui-bg-elevated) p-4">
        <UIcon name="i-lucide-lock" class="mt-0.5 size-4 shrink-0 text-(--ui-text-muted)" />
        <div class="space-y-2">
          <p class="text-sm font-medium text-(--ui-text-highlighted)">
            {{ access === 'login' ? t('run.locked.signInHeading') : t('run.locked.heading') }}
          </p>
          <p class="text-sm text-(--ui-text-muted)">
            {{ access === 'login'
              ? t('run.locked.anonymous', { modell: proc?.title ?? processId })
              : t('run.locked.signedIn', { modell: proc?.title ?? processId }) }}
          </p>
          <UButton v-if="access === 'login'" type="button" size="sm" icon="i-lucide-log-in" @click="login()">
            {{ t('auth.login') }}
          </UButton>
          <UButton v-else size="sm" variant="outline" color="neutral" :to="`/commons/${processId}`">
            {{ t('run.locked.toModel') }}
          </UButton>
        </div>
      </div>

      <p v-if="running && slow" class="text-sm text-(--ui-text-muted)">
        {{ t('run.slow') }}
      </p>

      <p v-if="errorText" class="text-sm text-red-600">
        {{ t('run.error', { msg: errorText }) }}
      </p>
    </form>

    <ScenarioMapWindow
      v-if="mapInputs.length"
      v-model:open="mapOpen"
      v-model:active="mapActive"
      v-model:values="form"
      :inputs="mapInputs"
      :extent="cityShape"
      :titles="inputTitles"
    />

  </div>
</template>
