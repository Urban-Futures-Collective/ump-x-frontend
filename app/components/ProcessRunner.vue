<script setup lang="ts">
import type { FeatureCollection } from 'geojson'

const props = defineProps<{ processId: string }>()
const emit = defineEmits<{ result: [FeatureCollection | null] }>()

const { t } = useI18n()
const { loggedIn } = useOidcAuth()
const { data: proc, pending: loadingProc } = useUmpProcess(() => props.processId)
const { data: ausfuehrbar } = useUmpRunnableProcesses()
const { run, jobId, status, progress, error, result, running } = useUmpRun()

// Seit der Katalog wieder allen alles zeigt, steht hier auch, was man nicht
// ausführen darf. Rico im Team-Chat: „man klickt auf Szenario ausführen und
// bekommt dann erst den Fehler". Deshalb vorher: Knopf aus, Grund darunter.
//
// Solange die Liste noch lädt, gilt nichts als gesperrt. Ein Knopf, der beim
// Laden kurz ausgegraut ist, wirkt kaputt.
const gesperrt = computed(() =>
  ausfuehrbar.value.length > 0 && !ausfuehrbar.value.includes(props.processId),
)

// Die Rolle heißt wie der Anbieter, also der Teil vor dem Doppelpunkt.
const anbieter = computed(() => props.processId.split(':')[0] ?? props.processId)

const form = ref<Record<string, string>>({})

// Formular mit Defaults initialisieren, sobald das Prozess-Detail geladen ist.
//
// Werte aus der Adresszeile (`?in.cityname=Oelde`) stechen die Vorgabe. Darüber
// übergibt der Chat einen vorbereiteten Lauf: er schlägt vor, die Adresszeile
// trägt den Vorschlag, und abgeschickt wird hier von Hand. Ein Tieflink statt
// eines geteilten Zustands, damit der Vorschlag ein Neuladen übersteht und
// sich weitergeben lässt.
const route = useRoute()

watch(proc, (p) => {
  const next: Record<string, string> = {}
  for (const inp of p?.inputs ?? []) {
    const ausAdresse = route.query[`in.${inp.name}`]
    next[inp.name] = typeof ausAdresse === 'string' && ausAdresse !== ''
      ? ausAdresse
      : inp.default != null ? String(inp.default) : ''
  }
  form.value = next
}, { immediate: true })

// Ergebnis nach außen (an die Karte) reichen.
watch(result, r => emit('result', r))

// Zahlenfelder können eine nicht-numerische Vorgabe nicht anzeigen: der Browser
// wirft "auto" aus einem type=number heraus. Das Feld sieht dann leer aus, und
// niemand erfährt, dass genau dieses Leerlassen die Vorgabe auslöst. Deshalb der
// Hinweis darunter — nur dort, wo die Vorgabe wirklich unsichtbar ist.
function vorgabeUnsichtbar(inp: { type: string, default?: unknown }) {
  if (inp.default == null) return false
  const zahlenfeld = inp.type === 'integer' || inp.type === 'number'
  return zahlenfeld && !Number.isFinite(Number(inp.default))
}

async function onSubmit() {
  // Die Regel liegt in app/utils/processInputs.ts, weil der Chat sie ebenfalls
  // anwendet. Zwei Fassungen davon wären zwei Wahrheiten über den "auto"-Default.
  await run(props.processId, bereinigeEingaben(proc.value?.inputs ?? [], form.value))
}
</script>

<template>
  <div class="space-y-4 rounded-lg border border-(--ui-border) p-4">
    <div>
      <h3 class="font-semibold">
        {{ proc?.title ?? processId }}
      </h3>
      <p v-if="proc?.description" class="text-sm text-(--ui-text-muted)">
        {{ proc.description }}
      </p>
    </div>

    <form class="space-y-3" @submit.prevent="onSubmit">
      <div v-for="inp in proc?.inputs ?? []" :key="inp.name" class="space-y-1">
        <label :for="`in-${inp.name}`" class="text-sm font-medium">
          {{ inp.title }}
          <span v-if="inp.required" class="text-(--ui-error)">*</span>
        </label>
        <UInput
          :id="`in-${inp.name}`"
          v-model="form[inp.name]"
          :type="inp.type === 'integer' || inp.type === 'number' ? 'number' : 'text'"
          :placeholder="inp.description"
          class="w-full"
        />
        <p v-if="vorgabeUnsichtbar(inp)" class="text-xs text-(--ui-text-dimmed)">
          {{ t('run.defaultHint', { wert: String(inp.default) }) }}
        </p>
      </div>

      <div class="flex items-center gap-3">
        <UButton type="submit" :loading="running" :disabled="loadingProc || gesperrt" icon="i-lucide-play">
          {{ t('run.execute') }}
        </UButton>
        <JobStatusBadge v-if="status !== 'idle'" :status="status" :progress="progress" />
        <!-- Anschluss nach dem Start: der Lauf ist auch nach einem Reload wiederzufinden. -->
        <ULink
          v-if="jobId"
          :to="`/jobs/${jobId}`"
          class="text-sm text-(--ui-text-muted) hover:text-(--ui-text)"
        >
          {{ t('run.openJob') }}
        </ULink>
        <ResultDownload
          v-if="jobId && status === 'successful'"
          :job-id="jobId"
          :process-id="processId"
        />
      </div>

      <p v-if="error" class="text-sm text-red-600">
        {{ t('run.error', { msg: error }) }}
      </p>
    </form>

    <!-- Gesperrt heißt nicht versteckt: das Formular bleibt sichtbar, damit man
         sieht, was das Modell könnte. Nur der Start ist zu, mit dem Grund
         daneben statt als Fehler nach dem Klick. -->
    <div v-if="gesperrt" class="flex gap-3 rounded-lg border border-(--ui-border) bg-(--ui-bg-elevated) p-4">
      <UIcon name="i-lucide-shield" class="mt-0.5 size-4 shrink-0 text-(--ui-text-muted)" />
      <div class="space-y-1">
        <p class="text-sm font-medium text-(--ui-text-highlighted)">
          {{ t('run.locked.heading') }}
        </p>
        <p class="text-sm text-(--ui-text-muted)">
          {{ loggedIn
            ? t('run.locked.signedIn', { modell: proc?.title ?? processId, anbieter })
            : t('run.locked.anonymous', { modell: proc?.title ?? processId }) }}
        </p>
      </div>
    </div>
  </div>
</template>
