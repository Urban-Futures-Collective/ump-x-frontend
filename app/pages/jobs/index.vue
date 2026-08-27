<script setup lang="ts">
// „Meine Szenarien": die eigenen Läufe aus GET /jobs/. Welche Läufe das sind,
// entscheidet die API anhand des Tokens, den der Proxy anhängt — hier wird
// bewusst nicht nachgefiltert, sonst gäbe es zwei Stellen, die Zugriff regeln.
definePageMeta({ middleware: ['auth'] })

const { t, locale } = useI18n()
const { data: jobs, pending, error, refresh } = useUmpJobs()
</script>

<template>
  <section class="mx-auto max-w-3xl space-y-4">
    <div class="flex items-center justify-between">
      <h1 class="text-xl font-semibold">
        {{ t('jobs.title') }}
      </h1>
      <UButton
        icon="i-lucide-refresh-cw"
        color="neutral"
        variant="ghost"
        size="xs"
        :loading="pending"
        @click="refresh()"
      >
        {{ t('jobs.refresh') }}
      </UButton>
    </div>

    <!-- Fehlerzustand vor dem Leerzustand: „API antwortet nicht" darf nie wie
         „keine Läufe" aussehen. -->
    <p v-if="error" class="text-sm text-red-600">
      {{ t('jobs.error') }}
    </p>

    <ul v-else-if="jobs?.length" class="space-y-2">
      <li v-for="job in jobs" :key="job.id">
        <ULink
          :to="`/jobs/${job.id}`"
          class="flex items-center justify-between gap-3 rounded-md border border-(--ui-border) px-4 py-3 transition-colors hover:bg-(--ui-bg-elevated)"
        >
          <span class="min-w-0">
            <span class="block truncate font-medium">{{ job.processId }}</span>
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
