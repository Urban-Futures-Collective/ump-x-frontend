<script setup lang="ts">
// Detail view of a run. The result goes through the same chain as /run
// (useUmpResult, then UmpMap), so there is only one seam between job and map.
definePageMeta({ middleware: ['auth'] })

const { t, locale } = useI18n()
const route = useRoute()
const jobId = computed(() => String(route.params.id))

const { job, result, resultError, pending, error, refresh } = useUmpJob(jobId)

const duration = computed(() => formatDuration(job.value?.created, job.value?.finished))

// While the run is still going, reload it every few seconds so status, progress and
// finally the result appear without pressing refresh.
const REFRESH_MS = 5000
const unfinished = computed(() => job.value?.status === 'accepted' || job.value?.status === 'running')
let timer: ReturnType<typeof setTimeout> | undefined
watch([unfinished, pending], ([open, loading]) => {
  clearTimeout(timer)
  if (open && !loading && import.meta.client) timer = setTimeout(() => refresh(), REFRESH_MS)
}, { immediate: true })
onBeforeUnmount(() => clearTimeout(timer))
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

    <p v-if="error" class="text-sm text-red-600">
      {{ t('jobs.notFound') }}
    </p>

    <template v-else-if="job">
      <div class="space-y-3 rounded-lg border border-(--ui-border) p-4">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <h1 class="truncate text-lg font-semibold">
              {{ job.processId ?? '–' }}
            </h1>
            <p class="truncate text-xs text-(--ui-text-muted)">
              {{ job.id }}
            </p>
          </div>
          <JobStatusBadge :status="job.status" :progress="job.progress" />
        </div>

        <!-- Show rows only when the API provides the value: created and finished
             may be empty depending on the instance; updated is always set. -->
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

        <div class="flex flex-wrap items-center gap-2">
          <!-- Without processID the run cannot be repeated: /run needs the process. -->
          <UButton
            v-if="job.processId"
            :to="{ path: '/run', query: { process: job.processId } }"
            variant="subtle"
            size="sm"
            icon="i-lucide-play"
          >
            {{ t('jobs.runAgain') }}
          </UButton>
          <!-- Download depends only on the run having succeeded, not on whether
               we could draw the result. See ResultDownload. -->
          <ResultDownload
            v-if="job.status === 'successful'"
            :job-id="job.id"
            :process-id="job.processId"
          />
        </div>
        <!-- The API recognises identical requests and returns the same run;
             without this hint a restart looks like an error. -->
        <p v-if="job.processId" class="text-xs text-(--ui-text-muted)">
          {{ t('jobs.cacheHint') }}
        </p>
      </div>

      <!-- Show the API message too: it gives the reason, the sentence above
           only the situation. See apiErrorMessage. -->
      <div v-if="resultError" class="space-y-1">
        <p class="text-sm text-red-600">
          {{ t('jobs.resultError') }}
        </p>
        <p class="text-xs text-(--ui-text-muted)">
          {{ resultError }}
        </p>
      </div>
      <p v-else-if="unfinished" class="text-sm text-(--ui-text-muted)">
        {{ t('jobs.resultPending') }}
      </p>
      <p v-else-if="job.status !== 'successful'" class="text-sm text-(--ui-text-muted)">
        {{ t('jobs.noResult') }}
      </p>

      <UmpMap v-if="result" :layer="result" />
      <ResultIndicators v-if="result" :layer="result" />
    </template>
  </section>
</template>
