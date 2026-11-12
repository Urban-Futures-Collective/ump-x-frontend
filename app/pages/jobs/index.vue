<script setup lang="ts">
// "My scenarios": the user's own runs from GET /jobs/. The API decides which
// runs these are based on the token the proxy attaches; no access filtering
// here, otherwise two places would control access. Runs of models that are no
// longer listed are left out (see runsOfAvailableModels).
import type { ListFilter } from '~/types/list'

definePageMeta({ middleware: ['auth'] })

const { t, locale } = useI18n()
const { data: allJobs, pending, error, refresh } = useUmpJobs()
const { data: processes, status: processesStatus } = useUmpProcesses()
const jobs = computed(() => runsOfAvailableModels(
  allJobs.value ?? [],
  processesStatus.value === 'success' ? (processes.value ?? []).map(p => p.id) : null,
))

// Search over model, run id, status and date, in the browser; sort and filter in the
// ListBar as on every list page.
const search = ref('')
const sortBy = ref('newest')
const sortItems = computed(() => [
  { value: 'newest', label: t('list.newest') },
  { value: 'model', label: t('jobs.sortModel') },
])
const filter = ref<Record<string, string[]>>({})
const filters = computed<ListFilter[]>(() => [{
  key: 'status',
  label: t('jobs.filter'),
  allLabel: t('jobs.filterAll'),
  items: [...new Set(jobs.value.map(j => j.status))].map(s => ({ value: s, label: t(`jobs.status.${s}`) })),
}])
const shown = computed(() => jobs.value
  .filter(job => !filter.value.status?.length || filter.value.status.includes(job.status))
  .filter(job => matchesSearch(search.value, job.processId, job.id, t(`jobs.status.${job.status}`), formatDateTime(jobTime(job), locale.value)))
  .sort((a, b) => sortBy.value === 'model'
    ? (a.processId ?? '').localeCompare(b.processId ?? '', locale.value)
    : String(jobTime(b) ?? '').localeCompare(String(jobTime(a) ?? ''))))
</script>

<template>
  <section class="mx-auto max-w-6xl space-y-6">
    <PageHeader :title="t('jobs.title')" :intro="t('jobs.intro')">
      <UInput
        v-if="jobs.length"
        v-model="search"
        type="search"
        icon="i-lucide-search"
        :placeholder="t('jobs.search')"
        :aria-label="t('jobs.search')"
        class="w-full sm:w-64"
      />
      <UButton color="neutral" variant="outline" icon="i-lucide-refresh-cw" :loading="pending" @click="() => { refresh() }">
        {{ t('jobs.refresh') }}
      </UButton>
      <!-- Always reachable, not only from the empty state (as "New model" in Contribute). -->
      <UButton icon="i-lucide-plus" to="/run">
        {{ t('nav.run') }}
      </UButton>
    </PageHeader>

    <ListBar v-if="jobs.length" v-model:sort="sortBy" v-model:filter="filter" :sort-items="sortItems" :filters="filters">
      <p class="pb-2 text-sm text-(--ui-text-muted)" role="status">
        {{ t('jobs.count', shown.length) }}
      </p>
    </ListBar>

    <!-- Error state before empty state: "API not responding" must never look
         like "no runs". -->
    <p v-if="error" class="text-sm text-red-600">
      {{ t('jobs.error') }}
    </p>

    <p v-else-if="jobs.length && !shown.length" class="text-sm text-(--ui-text-muted)" role="status">
      {{ search ? t('jobs.noMatch', { q: search }) : t('registry.noMatch') }}
    </p>

    <ul v-else-if="shown.length" class="space-y-2">
      <li v-for="job in shown" :key="job.id">
        <ULink
          :to="`/jobs/${job.id}`"
          class="flex items-center justify-between gap-3 rounded-md border border-(--ui-border) px-4 py-3 transition-colors hover:bg-(--ui-bg-elevated)"
        >
          <span class="min-w-0">
            <span class="block truncate font-medium">{{ job.processId ?? '–' }}</span>
            <span class="block text-sm text-(--ui-text-muted)">
              {{ formatDateTime(jobTime(job), locale) }}
            </span>
            <span class="block truncate text-xs text-(--ui-text-muted)">{{ job.id }}</span>
          </span>
          <span class="flex shrink-0 items-center gap-3">
            <JobStatusBadge :status="job.status" :progress="job.progress" />
            <UIcon name="i-lucide-arrow-right" class="text-(--ui-text-muted)" />
          </span>
        </ULink>
      </li>
    </ul>

    <div v-else-if="!pending" class="rounded-md border border-(--ui-border) px-4 py-8 text-center">
      <UIcon name="i-lucide-history" class="mx-auto mb-3 size-8 text-(--ui-text-muted)" />
      <p class="text-(--ui-text-muted)">
        {{ t('jobs.empty') }}
      </p>
      <UButton to="/run" class="mt-4" icon="i-lucide-play" variant="subtle">
        {{ t('nav.run') }}
      </UButton>
    </div>
  </section>
</template>
