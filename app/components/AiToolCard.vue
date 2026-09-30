<script setup lang="ts">
// One tool call in the chat. Expanded, a generic card shows exactly what was sent
// to the user's model provider.
import type { JobStatus } from '~/types/ump'
import type { Part } from '~/composables/useAiChat'
import type { ResultSummary } from '~/utils/resultSummary'

const props = defineProps<{ part: Extract<Part, { type: 'tool' }> }>()
const emit = defineEmits<{ opened: [] }>()

const { t, locale } = useI18n()

interface Output {
  error?: string
  models?: unknown[]
  runs?: unknown[]
  inputs?: Record<string, unknown> | unknown[]
  link?: string
  missing?: string[]
  unknown?: string[]
  process?: string
  status?: JobStatus
  progress?: number
  duration?: string
  result?: ResultSummary
  resultError?: string
}
const output = computed(() => props.part.output as Output | undefined)

const succeeded = computed(() => props.part.state === 'done' && !output.value?.error)

// Detected by tool name, not by the presence of a link: several tools return links.
const prepared = computed(() => props.part.name === 'prepareRun' && succeeded.value)
const jobShown = computed(() => props.part.name === 'showJob' && succeeded.value)

// The result summary as readable lines; the extent is shown as two corners
// rather than four bare numbers.
const resultLines = computed(() => {
  const e = output.value?.result
  if (!e) return []
  const lines = [
    t('ai.tools.features', { n: new Intl.NumberFormat(locale.value).format(e.count) })
    + (e.geometries.length ? ` · ${e.geometries.join(', ')}` : ''),
  ]
  if (e.bbox) {
    lines.push(t('ai.tools.extent', {
      from: `${e.bbox[0]}, ${e.bbox[1]}`,
      to: `${e.bbox[2]}, ${e.bbox[3]}`,
    }))
  }
  if (e.properties.length) {
    lines.push(t('ai.tools.properties', { list: e.properties.join(', ') }))
  }
  return lines
})

const label = computed(() => {
  const key = `ai.tools.${props.part.name}`
  const translated = t(key)
  // An unknown tool shows its name instead of the raw i18n key.
  return translated === key ? props.part.name : translated
})

// "done" only means the tool answered. Tools return errors as a field instead
// of throwing (see useUmpTools), so check it to avoid a checkmark on an error.
const icon = computed(() => {
  if (props.part.state === 'running') return 'i-lucide-wrench'
  if (props.part.state === 'error' || output.value?.error) return 'i-lucide-triangle-alert'
  return 'i-lucide-check'
})

const suffix = computed(() => {
  if (props.part.state === 'running') return t('ai.tools.running')
  if (props.part.state === 'error' || output.value?.error) return t('ai.tools.failed')
  if (Array.isArray(output.value?.models)) return t('ai.tools.count', { n: output.value.models.length })
  if (Array.isArray(output.value?.runs)) return t('ai.tools.runs', { n: output.value.runs.length })
  if (Array.isArray(output.value?.inputs)) return t('ai.tools.inputs', { n: output.value.inputs.length })
  return ''
})

// Recognised inputs as readable lines instead of raw JSON.
const recognised = computed(() => {
  const e = output.value?.inputs
  if (!e || Array.isArray(e)) return []
  return Object.entries(e).map(([k, v]) => `${k} = ${String(v)}`)
})

// Required inputs the model did not provide, and names the process does not know.
const missing = computed(() => output.value?.missing ?? [])
const unknownNames = computed(() => output.value?.unknown ?? [])
const incomplete = computed(() => missing.value.length > 0)

const content = computed(() => JSON.stringify(props.part.output ?? props.part.input ?? {}, null, 2))
</script>

<template>
  <div
    v-if="prepared"
    class="overflow-hidden rounded-lg border bg-(--ui-bg-elevated)"
    :class="incomplete ? 'border-(--ui-warning)' : 'border-(--ui-primary)'"
  >
    <div class="flex items-center gap-2 px-2.5 py-2">
      <UIcon
        :name="incomplete ? 'i-lucide-circle-alert' : 'i-lucide-play'"
        class="size-3.5"
        :class="incomplete ? 'text-(--ui-warning)' : 'text-(--ui-primary)'"
      />
      <span class="flex-1 text-sm font-medium">{{ t('ai.tools.prepareRun') }}</span>
      <span class="text-xs text-(--ui-text-dimmed)">{{ (part.input as { processId?: string })?.processId?.split(':').pop() }}</span>
    </div>
    <div class="space-y-1.5 border-t border-(--ui-border) px-2.5 py-2.5">
      <p v-if="recognised.length" class="text-xs text-(--ui-text-muted)">
        {{ t('ai.tools.recognised') }}
      </p>
      <p v-for="line in recognised" :key="line" class="text-xs text-(--ui-text-dimmed)">
        {{ line }}
      </p>
      <!-- Missing inputs go above the button so they are read before clicking through. -->
      <p v-if="missing.length" class="text-xs font-medium text-(--ui-warning)">
        {{ t('ai.tools.missing', { list: missing.join(', ') }) }}
      </p>
      <p v-if="unknownNames.length" class="text-xs text-(--ui-text-muted)">
        {{ t('ai.tools.unknown', { list: unknownNames.join(', ') }) }}
      </p>
      <UButton :to="output?.link" size="xs" class="mt-1" @click="emit('opened')">
        {{ t('ai.tools.openForm') }}
      </UButton>
      <p class="text-xs text-(--ui-text-dimmed)">
        {{ t('ai.tools.startedByYou') }}
      </p>
    </div>
  </div>

  <!-- A shown job is information, not a proposal: no start button, just a link to
       its page (map and download). The summary is all the model received too. -->
  <div
    v-else-if="jobShown"
    class="overflow-hidden rounded-lg border border-(--ui-border) bg-(--ui-bg-elevated)"
  >
    <div class="flex items-center gap-2 px-2.5 py-2">
      <UIcon name="i-lucide-history" class="size-3.5 text-(--ui-text-muted)" />
      <span class="flex-1 text-sm font-medium">{{ output?.process?.split(':').pop() ?? t('ai.tools.showJob') }}</span>
      <JobStatusBadge v-if="output?.status" :status="output.status" :progress="output.progress" />
    </div>
    <div class="space-y-1.5 border-t border-(--ui-border) px-2.5 py-2.5">
      <p v-if="output?.duration" class="text-xs text-(--ui-text-muted)">
        {{ t('jobs.duration') }}: {{ output.duration }}
      </p>
      <p v-for="line in resultLines" :key="line" class="text-xs text-(--ui-text-dimmed)">
        {{ line }}
      </p>
      <p v-if="output?.resultError" class="text-xs text-(--ui-text-muted)">
        {{ t('jobs.resultError') }}
      </p>
      <UButton
        v-if="output?.link"
        :to="output.link"
        variant="subtle"
        size="xs"
        class="mt-1"
        @click="emit('opened')"
      >
        {{ t('ai.tools.openJob') }}
      </UButton>
    </div>
  </div>

  <UChatTool
    v-else
    :text="label"
    :suffix="suffix"
    :icon="icon"
    :loading="part.state === 'running'"
  >
    <div class="space-y-1">
      <p class="text-xs text-(--ui-text-muted)">
        {{ t('ai.tools.sentToProvider') }}
      </p>
      <pre class="max-h-64 overflow-auto whitespace-pre-wrap break-all text-xs text-(--ui-text-dimmed)">{{ content }}</pre>
    </div>
  </UChatTool>
</template>
