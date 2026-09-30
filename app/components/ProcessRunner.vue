<script setup lang="ts">
import type { ResultLayer } from '~/types/ump'

const props = defineProps<{ processId: string }>()
const emit = defineEmits<{ result: [ResultLayer | null] }>()

const { t } = useI18n()
// Awaited so the form already carries its values during SSR. Without await the
// watch below ran on the server before the detail arrived, server and client
// rendered different values and every field hit a hydration mismatch.
const { data: proc, pending: loadingProc } = await useUmpProcess(() => props.processId)
const { run, jobId, status, progress, error, result, running } = useUmpRun()

// A job that fails without a message only yields its status as a key, a
// response without a body only its HTTP status. Translate those two; anything
// else is already text from UMP or the model.
const fehlertext = computed(() => {
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

function anfangswerte(p: typeof proc.value): Record<string, string> {
  const next: Record<string, string> = {}
  for (const inp of p?.inputs ?? []) {
    const ausAdresse = route.query[`in.${inp.name}`]
    next[inp.name] = typeof ausAdresse === 'string' && ausAdresse !== ''
      ? ausAdresse
      : inp.default != null ? String(inp.default) : ''
  }
  return next
}

const form = ref<Record<string, string>>(anfangswerte(proc.value))
watch(proc, p => (form.value = anfangswerte(p)))

// Pass the result up to the map.
watch(result, r => emit('result', r))

// Number inputs cannot show a non-numeric default: the browser drops "auto"
// from a type=number field. The field looks empty and nobody learns that
// leaving it empty is what applies the default, so show a hint below it, but
// only where the default is actually invisible.
function vorgabeUnsichtbar(inp: { type: string, default?: unknown }) {
  if (inp.default == null) return false
  const zahlenfeld = inp.type === 'integer' || inp.type === 'number'
  return zahlenfeld && !Number.isFinite(Number(inp.default))
}

async function onSubmit() {
  // The rule lives in app/utils/processInputs.ts because the chat applies it
  // too; two copies would disagree about the "auto" default.
  await run(props.processId, bereinigeEingaben(proc.value?.inputs ?? [], form.value))
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
        <UInput
          :id="`in-${inp.name}`"
          v-model="form[inp.name]"
          :type="inp.type === 'integer' || inp.type === 'number' ? 'number' : 'text'"
          :placeholder="inp.description"
          class="w-full"
        />
        <p v-if="vorgabeUnsichtbar(inp)" class="text-xs text-(--ui-text-dimmed)">
          {{ t('run.defaultHint', { wert: String(inp.default) }) }}
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

      <p v-if="fehlertext" class="text-sm text-red-600">
        {{ t('run.error', { msg: fehlertext }) }}
      </p>
    </form>

  </div>
</template>
