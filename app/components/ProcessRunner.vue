<script setup lang="ts">
import type { ResultLayer } from '~/types/ump'

const props = defineProps<{ processId: string }>()
const emit = defineEmits<{ result: [ResultLayer | null] }>()

const { t } = useI18n()
// Awaited so the form already carries its values during SSR. Without await the
// watch below ran on the server before the detail arrived, server and client
// rendered different values and every field hit a hydration mismatch.
const { data: proc, pending: loadingProc } = await useUmpProcess(() => props.processId)
const { run, jobId, status, progress, error, result, running, slow } = useUmpRun()

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
const problems = computed(() => Object.fromEntries(
  (proc.value?.inputs ?? []).map(inp => [inp.name, inputProblem(inp, form.value[inp.name])]),
))
function shownProblem(name: string) {
  const p = problems.value[name]
  if (!p || (p.key === 'required' && !attempted.value)) return null
  return p.key === 'pattern'
    ? t('run.invalid.pattern', { pattern: p.pattern })
    : t(`run.invalid.${p.key}`, 'limit' in p ? { limit: p.limit } : {})
}

async function onSubmit() {
  attempted.value = true
  if (Object.values(problems.value).some(Boolean)) return
  // The rule lives in app/utils/processInputs.ts because the chat applies it
  // too; two copies would disagree about the "auto" default.
  await run(props.processId, cleanInputs(proc.value?.inputs ?? [], form.value))
}
</script>

<template>
  <div class="space-y-4 rounded-lg border border-(--ui-border) p-4">
    <div>
      <h3 class="font-semibold">
        {{ proc?.title ?? processId }}
      </h3>
      <p v-if="proc?.description" class="text-sm text-(--ui-text-muted)">
        {{ proc.description }}
      </p>
    </div>

    <form class="space-y-3" @submit.prevent="onSubmit">
      <div v-for="inp in proc?.inputs ?? []" :key="inp.name" class="space-y-1">
        <label :for="`in-${inp.name}`" class="text-sm font-medium">
          {{ inp.title }}
          <span v-if="inp.required" class="text-(--ui-error)">*</span>
        </label>
        <!-- Yes/no as a switch; the form keeps text values, so it stores "true"/"false". -->
        <div v-if="inp.type === 'boolean'" class="space-y-1">
          <USwitch
            :id="`in-${inp.name}`"
            :model-value="form[inp.name] === 'true'"
            @update:model-value="on => { form[inp.name] = on ? 'true' : 'false' }"
          />
          <p v-if="inp.description" class="text-xs text-(--ui-text-dimmed)">
            {{ inp.description }}
          </p>
        </div>
        <GeometryInput
          v-else-if="isGeometryInput(inp.schema)"
          v-model="form[inp.name]!"
          :schema="inp.schema"
        />
        <UInput
          v-else
          :id="`in-${inp.name}`"
          v-model="form[inp.name]"
          :type="inp.type === 'integer' || inp.type === 'number' ? 'number' : 'text'"
          :placeholder="inp.description"
          :color="shownProblem(inp.name) ? 'error' : undefined"
          :highlight="!!shownProblem(inp.name)"
          class="w-full"
        />
        <p v-if="shownProblem(inp.name)" class="text-xs text-red-600">
          {{ shownProblem(inp.name) }}
        </p>
        <p v-if="defaultInvisible(inp)" class="text-xs text-(--ui-text-dimmed)">
          {{ t('run.defaultHint', { value: String(inp.default) }) }}
        </p>
      </div>

      <div class="flex items-center gap-3">
        <UButton type="submit" :loading="running" :disabled="loadingProc" icon="i-lucide-play">
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

      <p v-if="running && slow" class="text-sm text-(--ui-text-muted)">
        {{ t('run.slow') }}
      </p>

      <p v-if="errorText" class="text-sm text-red-600">
        {{ t('run.error', { msg: errorText }) }}
      </p>
    </form>

  </div>
</template>
