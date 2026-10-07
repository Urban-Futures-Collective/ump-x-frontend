<script setup lang="ts">
import type { RegistryStatus } from '~/types/registry'

defineProps<{ status: RegistryStatus }>()
const { t } = useI18n()

// One colour per kind of state: in progress (neutral), waiting for someone (info),
// needs the owner (warning), done (success), stopped (error).
const COLORS: Record<RegistryStatus, 'neutral' | 'info' | 'warning' | 'success' | 'error'> = {
  draft: 'neutral',
  submitted: 'info',
  in_review: 'info',
  changes_requested: 'warning',
  rejected: 'error',
  verified: 'success',
  published: 'success',
  deactivated: 'error',
}
</script>

<template>
  <UBadge :color="COLORS[status]" variant="subtle" size="sm">
    {{ t(`registry.status.${status}`) }}
  </UBadge>
</template>
