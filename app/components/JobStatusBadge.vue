<script setup lang="ts">
import type { JobStatus } from '~/types/ump'

// Eine Stelle für die Übersetzung „Status → Farbe/Text", damit Liste, Detailseite
// und der laufende Prozess dasselbe zeigen.
const props = defineProps<{ status: JobStatus | 'idle', progress?: number }>()

const { t } = useI18n()

const color = computed(() => {
  switch (props.status) {
    case 'successful': return 'success'
    case 'failed':
    case 'dismissed': return 'error'
    case 'running':
    case 'accepted': return 'info'
    default: return 'neutral'
  }
})

const running = computed(() => props.status === 'running' || props.status === 'accepted')
</script>

<template>
  <UBadge :color="color" variant="subtle">
    {{ t(`jobs.status.${status}`) }}<span v-if="running && progress"> · {{ progress }}%</span>
  </UBadge>
</template>
