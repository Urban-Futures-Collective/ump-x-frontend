<script setup lang="ts">
// Downloads a run's result.
//
// A link to the proxy path rather than a blob built from the parsed data: the
// API response is passed through unchanged, so the file is whatever the model
// returns. This also works for results the map cannot render.
//
// The path is same-origin (behind the proxy), so the browser honours the
// download attribute and sends the session cookies.
const props = defineProps<{ jobId: string, processId?: string }>()

const { t } = useI18n()
const { base } = useUmpBase()

// File name must be recognisable in a downloads folder without context:
// process name plus short job id. Run inputs are not available here, since the
// job response does not include them.
const basisname = computed(() => {
  const prozess = (props.processId ?? 'ergebnis').split(':').pop() ?? 'ergebnis'
  return `${prozess}_${props.jobId.slice(0, 8)}`
})

// Sent without an extension, which is unknown before the response arrives. The
// proxy appends it from the Content-Type and sets Content-Disposition
// (see server/routes/ump/[...path].ts).
const href = computed(() =>
  `${base}/jobs/${props.jobId}/results?filename=${encodeURIComponent(basisname.value)}`,
)

// Fallback if no Content-Disposition arrives; .geojson fits the current
// models. When the header is present it wins, so other formats still get the
// right extension.
const rueckfall = computed(() => `${basisname.value}.geojson`)
</script>

<template>
  <UButton
    :to="href"
    :download="rueckfall"
    external
    variant="subtle"
    size="sm"
    icon="i-lucide-download"
  >
    {{ t('jobs.download') }}
  </UButton>
</template>
