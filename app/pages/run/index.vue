<script setup lang="ts">
import type { ResultLayer } from '~/types/ump'

// Run a new scenario. The model comes via query param (/run?process=<id>, set by
// the catalog); a compact list on the left allows switching, so /run also works
// on its own. The route shape (query param vs. /commons/[id]/run) is not fixed
// yet and cheap to change.
const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const { data: processes, pending, error } = useUmpProcesses()

const queryProcess = computed(() =>
  typeof route.query.process === 'string' ? route.query.process : null,
)
const selectedProcessId = ref<string | null>(queryProcess.value)
const mapData = ref<ResultLayer | null>(null)

function selectProcess(id: string) {
  selectedProcessId.value = id
  mapData.value = null
  // Mirror the selection in the URL: shareable link, survives a reload.
  router.replace({ query: { process: id } })
}

// If the query param changes (e.g. navigation from the catalog), follow it.
watch(queryProcess, (id) => {
  if (id && id !== selectedProcessId.value) {
    selectedProcessId.value = id
    mapData.value = null
  }
})
</script>

<template>
  <div class="grid gap-6 lg:grid-cols-[20rem_1fr]">
    <!-- Model selection (compact) -->
    <section class="space-y-3">
      <div class="flex items-center justify-between">
        <h2 class="text-lg font-semibold">
          {{ t('nav.models') }}
        </h2>
        <ULink to="/commons" class="text-sm text-(--ui-text-muted) hover:text-(--ui-text)">
          {{ t('run.allModels') }}
        </ULink>
      </div>

      <p v-if="error" class="text-sm text-red-600">
        {{ t('processes.error', { msg: apiErrorMessage(error) }) }}
      </p>

      <ul v-if="processes?.length" class="space-y-1">
        <li v-for="p in processes" :key="p.id">
          <button
            type="button"
            class="w-full rounded-md border px-3 py-2 text-left transition-colors"
            :class="p.id === selectedProcessId
              ? 'border-(--ui-primary) bg-(--ui-primary)/5'
              : 'border-(--ui-border) hover:bg-(--ui-bg-elevated)'"
            @click="selectProcess(p.id)"
          >
            <div class="flex items-center gap-2">
              <span class="font-medium">{{ p.title }}</span>
            </div>
            <div class="text-xs text-(--ui-text-muted)">{{ p.id }}</div>
          </button>
        </li>
      </ul>
      <p v-else-if="!pending" class="text-sm text-(--ui-text-muted)">
        {{ t('processes.empty') }}
      </p>
    </section>

    <!-- Runner + map. Side by side only from xl: below that, two columns next to
         the model list are too narrow for both the inputs and the map. -->
    <section class="grid items-start gap-4 xl:grid-cols-2">
      <div class="space-y-4">
        <ProcessRunner
          v-if="selectedProcessId"
          :key="selectedProcessId"
          :process-id="selectedProcessId"
          @result="mapData = $event"
        />
        <p v-else class="text-sm text-(--ui-text-muted)">
          {{ t('run.selectHint') }}
        </p>
      </div>

      <UmpMap :layer="mapData" />
    </section>
  </div>
</template>
