<script setup lang="ts">
import type { RegistryStatus } from '~/types/registry'

// Verify: newly submitted models on the left, all models with their status on the right.
// Drafts are the owner's business and not listed. Prototype with sample data.
definePageMeta({ middleware: ['auth', 'prototype', 'verifier'] })
const { t, locale } = useI18n()
const { models, awaitingReview } = useRegistryPrototype()

const search = ref('')
const statusFilter = ref<RegistryStatus | 'all'>('all')
const statusItems = computed(() => [
  { label: t('registry.verify.allStatuses'), value: 'all' },
  ...(['submitted', 'in_review', 'changes_requested', 'verified', 'published', 'rejected', 'deactivated'] as RegistryStatus[])
    .map(s => ({ label: t(`registry.status.${s}`), value: s })),
])

const matches = (q: string) => (m: (typeof models.value)[number]) => !q
  || [inLang(m.fullName, locale.value, m.defaultLang), m.remoteProcessId, m.serverName].some(s => s.toLowerCase().includes(q))

const all = computed(() => {
  const q = search.value.trim().toLowerCase()
  return models.value
    .filter(m => m.status !== 'draft')
    .filter(m => statusFilter.value === 'all' || m.status === statusFilter.value)
    .filter(matches(q))
    .sort((a, b) => b.statusChangedAt.localeCompare(a.statusChangedAt))
})
const fresh = computed(() => awaitingReview.value.filter(matches(search.value.trim().toLowerCase())))
</script>

<template>
  <section class="max-w-6xl space-y-6">
    <PrototypeNotice />

    <div class="flex flex-wrap items-start justify-between gap-4">
      <div class="space-y-1">
        <h1 class="text-2xl font-semibold text-ufc-slate-900">
          {{ t('registry.verify.title') }}
        </h1>
        <p class="text-sm text-(--ui-text-muted)">
          {{ t('registry.verify.intro') }}
        </p>
      </div>
      <UInput v-model="search" icon="i-lucide-search" :placeholder="t('registry.search')" :aria-label="t('registry.search')" size="sm" />
    </div>

    <div class="grid gap-8 lg:grid-cols-2">
      <div class="space-y-3">
        <h2 class="text-lg font-semibold">
          {{ t('registry.verify.fresh') }}
          <UBadge v-if="fresh.length" color="info" variant="subtle" size="sm" class="ml-1">
            {{ fresh.length }}
          </UBadge>
        </h2>
        <p v-if="!fresh.length" class="text-sm text-(--ui-text-muted)">
          {{ t('registry.verify.noneFresh') }}
        </p>
        <ul v-else class="space-y-3">
          <li v-for="m in fresh" :key="m.id">
            <RegistryModelCard :model="m" :to="`/verify/${m.id}`" show-owner />
          </li>
        </ul>
      </div>

      <div class="space-y-3">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <h2 class="text-lg font-semibold">
            {{ t('registry.verify.all') }}
          </h2>
          <USelect v-model="statusFilter" :items="statusItems" size="sm" class="w-48" :aria-label="t('registry.verify.filter')" />
        </div>
        <p v-if="!all.length" class="text-sm text-(--ui-text-muted)">
          {{ t('registry.noMatch') }}
        </p>
        <ul v-else class="space-y-3">
          <li v-for="m in all" :key="m.id">
            <RegistryModelCard :model="m" :to="`/verify/${m.id}`" show-owner />
          </li>
        </ul>
      </div>
    </div>
  </section>
</template>
