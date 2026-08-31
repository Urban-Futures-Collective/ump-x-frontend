<script setup lang="ts">
import type { FeatureCollection } from 'geojson'

// Neues Szenario ausführen: übernimmt ProcessRunner + UmpMap + Ergebnis-Pfad aus der
// bisherigen app.vue. Das Modell kommt via Query-Param (/run?process=<id>, gesetzt vom
// Katalog); links steht eine kompakte Liste zum Wechseln, damit /run selbstständig nutzbar
// ist. Route-Form (Query-Param vs. /models/[id]/run) ist bewusst offen — Umstieg billig.
const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const { data: processes, pending, error } = useUmpProcesses()

const queryProcess = computed(() =>
  typeof route.query.process === 'string' ? route.query.process : null,
)
const selectedProcessId = ref<string | null>(queryProcess.value)
const mapData = ref<FeatureCollection | null>(null)

function selectProcess(id: string) {
  selectedProcessId.value = id
  mapData.value = null
  // Auswahl in der URL spiegeln → teilbarer Link, Reload-fest.
  router.replace({ query: { process: id } })
}

// Wechselt der Query-Param (z. B. Navigation vom Katalog), Auswahl nachziehen.
watch(queryProcess, (id) => {
  if (id && id !== selectedProcessId.value) {
    selectedProcessId.value = id
    mapData.value = null
  }
})
</script>

<template>
  <div class="grid gap-6 lg:grid-cols-[20rem_1fr]">
    <!-- Modell-Auswahl (kompakt) -->
    <section class="space-y-3">
      <div class="flex items-center justify-between">
        <h2 class="text-lg font-semibold">
          {{ t('nav.models') }}
        </h2>
        <ULink to="/models" class="text-sm text-(--ui-text-muted) hover:text-(--ui-text)">
          {{ t('run.allModels') }}
        </ULink>
      </div>

      <p v-if="error" class="text-sm text-red-600">
        {{ t('processes.error') }}
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
            <div class="font-medium">{{ p.title }}</div>
            <div class="text-xs text-(--ui-text-muted)">{{ p.id }}</div>
          </button>
        </li>
      </ul>
      <p v-else-if="!pending" class="text-sm text-(--ui-text-muted)">
        {{ t('processes.empty') }}
      </p>
    </section>

    <!-- Runner + Karte. Ab xl nebeneinander: darunter bleiben zwei Spalten neben der
         Modell-Liste zu schmal, sowohl für die Eingabefelder als auch für die Karte. -->
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

      <UmpMap :data="mapData" />
    </section>
  </div>
</template>
