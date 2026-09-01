<script setup lang="ts">
import type { FeatureCollection } from 'geojson'

const props = defineProps<{ processId: string }>()
const emit = defineEmits<{ result: [FeatureCollection | null] }>()

const { t } = useI18n()
const { data: proc, pending: loadingProc } = useUmpProcess(() => props.processId)
const { run, jobId, status, progress, error, result, running } = useUmpRun()

const form = ref<Record<string, string>>({})

// Formular mit Defaults initialisieren, sobald das Prozess-Detail geladen ist.
watch(proc, (p) => {
  const next: Record<string, string> = {}
  for (const inp of p?.inputs ?? []) {
    next[inp.name] = inp.default != null ? String(inp.default) : ''
  }
  form.value = next
}, { immediate: true })

// Ergebnis nach außen (an die Karte) reichen.
watch(result, r => emit('result', r))

async function onSubmit() {
  const inputs: Record<string, unknown> = {}
  for (const inp of proc.value?.inputs ?? []) {
    const raw = (form.value[inp.name] ?? '').trim()
    const def = inp.default != null ? String(inp.default) : ''
    // Leeres nicht senden; unveränderte Defaults weglassen → das Backend nutzt seine
    // eigenen Defaults (wichtig für growbike, dessen Integer-Inputs den String "auto"
    // als Default haben — ein Number("auto") würde NaN senden und den Prozess crashen).
    if (raw === '') continue
    if (def !== '' && raw === def) continue
    if ((inp.type === 'integer' || inp.type === 'number') && Number.isFinite(Number(raw))) {
      inputs[inp.name] = Number(raw)
    }
    else if (inp.type === 'boolean') {
      inputs[inp.name] = raw === 'true' || raw === '1'
    }
    else {
      inputs[inp.name] = raw
    }
  }
  await run(props.processId, inputs)
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
      </div>

      <div class="flex items-center gap-3">
        <UButton type="submit" :loading="running" :disabled="loadingProc" icon="i-lucide-play">
          {{ t('run.execute') }}
        </UButton>
        <JobStatusBadge v-if="status !== 'idle'" :status="status" :progress="progress" />
        <!-- Anschluss nach dem Start: der Lauf ist auch nach einem Reload wiederzufinden. -->
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

      <p v-if="error" class="text-sm text-red-600">
        {{ t('run.error', { msg: error }) }}
      </p>
    </form>
  </div>
</template>
