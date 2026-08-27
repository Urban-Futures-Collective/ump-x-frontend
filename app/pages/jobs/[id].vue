<script setup lang="ts">
// Detailansicht eines Laufs. Das Ergebnis läuft über dieselbe Kette wie /run
// (useUmpResult → UmpMap), damit es nur eine Naht zwischen Job und Karte gibt.
definePageMeta({ middleware: ['auth'] })

const { t, locale } = useI18n()
const route = useRoute()
const jobId = computed(() => String(route.params.id))

const { job, pending, error, refresh, result, resultPending, resultError, loadResult }
  = useUmpJob(jobId)

// Ergebnis erst holen, wenn der Lauf tatsächlich erfolgreich war — bei einem
// gescheiterten antwortet /results mit 404 („Job failed").
watch(job, () => loadResult(), { immediate: true })

const duration = computed(() => formatDuration(job.value?.created, job.value?.finished))
</script>

<template>
  <section class="mx-auto max-w-3xl space-y-4">
    <div class="flex items-center justify-between gap-3">
      <ULink to="/jobs" class="flex items-center gap-1 text-sm text-(--ui-text-muted) hover:text-(--ui-text)">
        <UIcon name="i-lucide-arrow-left" />
        {{ t('jobs.title') }}
      </ULink>
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

    <p v-if="error" class="text-sm text-red-600 dark:text-red-400">
      {{ t('jobs.notFound') }}
    </p>

    <template v-else-if="job">
      <div class="space-y-3 rounded-lg border border-(--ui-border) p-4">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <h1 class="truncate text-lg font-semibold">
              {{ job.processId }}
            </h1>
            <p class="truncate text-xs text-(--ui-text-muted)">
              {{ job.id }}
            </p>
          </div>
          <JobStatusBadge :status="job.status" :progress="job.progress" />
        </div>

        <!-- Zeilen nur zeigen, wenn die API den Wert auch liefert: created und
             finished bleiben je nach Instanz leer, updated ist immer gesetzt. -->
        <dl class="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-[auto_1fr]">
          <template v-if="job.created">
            <dt class="text-(--ui-text-muted)">
              {{ t('jobs.created') }}
            </dt>
            <dd>{{ formatDateTime(job.created, locale) }}</dd>
          </template>
          <template v-if="job.finished">
            <dt class="text-(--ui-text-muted)">
              {{ t('jobs.finished') }}
            </dt>
            <dd>{{ formatDateTime(job.finished, locale) }}</dd>
          </template>
          <template v-if="duration">
            <dt class="text-(--ui-text-muted)">
              {{ t('jobs.duration') }}
            </dt>
            <dd>{{ duration }}</dd>
          </template>
          <dt class="text-(--ui-text-muted)">
            {{ t('jobs.updated') }}
          </dt>
          <dd>{{ formatDateTime(job.updated, locale) }}</dd>
        </dl>

        <p v-if="job.message" class="rounded-md bg-(--ui-bg-elevated) px-3 py-2 text-sm text-(--ui-text-muted)">
          {{ job.message }}
        </p>

        <UButton
          :to="{ path: '/run', query: { process: job.processId } }"
          variant="subtle"
          size="sm"
          icon="i-lucide-play"
        >
          {{ t('jobs.runAgain') }}
        </UButton>
        <!-- Die API erkennt identische Anfragen wieder und gibt denselben Lauf
             zurück; ohne diesen Hinweis wirkt ein erneuter Start wie ein Fehler. -->
        <p class="text-xs text-(--ui-text-muted)">
          {{ t('jobs.cacheHint') }}
        </p>
      </div>

      <p v-if="resultPending" class="text-sm text-(--ui-text-muted)">
        {{ t('jobs.resultLoading') }}
      </p>
      <p v-else-if="resultError" class="text-sm text-red-600 dark:text-red-400">
        {{ t('jobs.resultError') }}
      </p>
      <p v-else-if="job.status !== 'successful'" class="text-sm text-(--ui-text-muted)">
        {{ t('jobs.noResult') }}
      </p>

      <UmpMap v-if="result" :data="result" />
    </template>
  </section>
</template>
