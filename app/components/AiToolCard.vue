<script setup lang="ts">
// Ein Werkzeugaufruf im Chat.
//
// Lesende Werkzeuge zeigen aufgeklappt, was tatsächlich an den Anbieter
// gegangen ist. Das ist kein Schmuck: unter dem Zugangsformular steht, dass
// Fragen und Werkzeug-Ergebnisse beim gewählten Anbieter landen. Ohne diese
// Ansicht wäre das eine Behauptung, die niemand nachprüfen kann.
//
// Ein vorbereiteter Lauf sieht bewusst anders aus. Er trägt einen Knopf, weil
// hier der Vorschlag endet und der Mensch übernimmt: die KI schlägt vor, sie
// startet nichts.
import type { JobStatus } from '~/types/ump'
import type { Teil } from '~/composables/useAiChat'
import type { ErgebnisZusammenfassung } from '~/utils/resultSummary'

const props = defineProps<{ teil: Extract<Teil, { type: 'werkzeug' }> }>()
const emit = defineEmits<{ geoeffnet: [] }>()

const { t, locale } = useI18n()

interface Ausgabe {
  fehler?: string
  modelle?: unknown[]
  laeufe?: unknown[]
  eingaben?: Record<string, unknown> | unknown[]
  link?: string
  prozess?: string
  status?: JobStatus
  fortschritt?: number
  dauer?: string
  ergebnis?: ErgebnisZusammenfassung
  ergebnisFehler?: string
}
const ausgabe = computed(() => props.teil.ausgabe as Ausgabe | undefined)

const gelungen = computed(() => props.teil.zustand === 'fertig' && !ausgabe.value?.fehler)

// Am Werkzeugnamen erkannt, nicht am Link. Seit showJob ebenfalls einen Link
// liefert, wäre „hat einen Link" nicht mehr dasselbe wie „ist ein Vorschlag".
const vorbereitet = computed(() => props.teil.name === 'prepareRun' && gelungen.value)
const lauf = computed(() => props.teil.name === 'showJob' && gelungen.value)

// Die Zusammenfassung als lesbare Zeilen. Die Ausdehnung steht als Eckenpaar da
// und nicht als vier lose Zahlen, sonst liest sie niemand.
const ergebniszeilen = computed(() => {
  const e = ausgabe.value?.ergebnis
  if (!e) return []
  const zeilen = [
    t('ai.tools.features', { n: new Intl.NumberFormat(locale.value).format(e.anzahl) })
    + (e.geometrien.length ? ` · ${e.geometrien.join(', ')}` : ''),
  ]
  if (e.bbox) {
    zeilen.push(t('ai.tools.extent', {
      von: `${e.bbox[0]}, ${e.bbox[1]}`,
      bis: `${e.bbox[2]}, ${e.bbox[3]}`,
    }))
  }
  if (e.eigenschaften.length) {
    zeilen.push(t('ai.tools.properties', { liste: e.eigenschaften.join(', ') }))
  }
  return zeilen
})

const beschriftung = computed(() => {
  const schluessel = `ai.tools.${props.teil.name}`
  const uebersetzt = t(schluessel)
  // Ein unbekanntes Werkzeug soll seinen Namen zeigen statt den i18n-Schlüssel.
  return uebersetzt === schluessel ? props.teil.name : uebersetzt
})

// „Fertig" heißt nur, dass das Werkzeug geantwortet hat. Werkzeuge geben ihre
// Fehler als Feld zurück statt zu werfen (siehe useUmpTools), sonst risse der
// Strom ab. Ein Häkchen über einer Fehlermeldung wäre deshalb genau falsch.
const symbol = computed(() => {
  if (props.teil.zustand === 'laeuft') return 'i-lucide-wrench'
  if (props.teil.zustand === 'fehler' || ausgabe.value?.fehler) return 'i-lucide-triangle-alert'
  return 'i-lucide-check'
})

const zusatz = computed(() => {
  if (props.teil.zustand === 'laeuft') return t('ai.tools.running')
  if (props.teil.zustand === 'fehler' || ausgabe.value?.fehler) return t('ai.tools.failed')
  if (Array.isArray(ausgabe.value?.modelle)) return t('ai.tools.count', { n: ausgabe.value.modelle.length })
  if (Array.isArray(ausgabe.value?.laeufe)) return t('ai.tools.runs', { n: ausgabe.value.laeufe.length })
  if (Array.isArray(ausgabe.value?.eingaben)) return t('ai.tools.inputs', { n: ausgabe.value.eingaben.length })
  return ''
})

// Die erkannten Eingaben als Zeilen, damit man sie liest statt JSON zu entziffern.
const erkannt = computed(() => {
  const e = ausgabe.value?.eingaben
  if (!e || Array.isArray(e)) return []
  return Object.entries(e).map(([k, v]) => `${k} = ${String(v)}`)
})

const inhalt = computed(() => JSON.stringify(props.teil.ausgabe ?? props.teil.eingabe ?? {}, null, 2))
</script>

<template>
  <div
    v-if="vorbereitet"
    class="overflow-hidden rounded-lg border border-(--ui-primary) bg-(--ui-bg-elevated)"
  >
    <div class="flex items-center gap-2 px-2.5 py-2">
      <UIcon name="i-lucide-play" class="size-3.5 text-(--ui-primary)" />
      <span class="flex-1 text-sm font-medium">{{ t('ai.tools.prepareRun') }}</span>
      <span class="text-xs text-(--ui-text-dimmed)">{{ (teil.eingabe as { processId?: string })?.processId?.split(':').pop() }}</span>
    </div>
    <div class="space-y-1.5 border-t border-(--ui-border) px-2.5 py-2.5">
      <p class="text-xs text-(--ui-text-muted)">
        {{ t('ai.tools.recognised') }}
      </p>
      <p v-for="zeile in erkannt" :key="zeile" class="text-xs text-(--ui-text-dimmed)">
        {{ zeile }}
      </p>
      <UButton :to="ausgabe?.link" size="xs" class="mt-1" @click="emit('geoeffnet')">
        {{ t('ai.tools.openForm') }}
      </UButton>
      <p class="text-xs text-(--ui-text-dimmed)">
        {{ t('ai.tools.startedByYou') }}
      </p>
    </div>
  </div>

  <!-- Ein gezeigter Lauf ist eine Auskunft, kein Vorschlag: er trägt deshalb
       keinen Startknopf, sondern den Weg zur Karte und zum Download. Die
       Zusammenfassung ist alles, was auch das Modell bekommen hat. -->
  <div
    v-else-if="lauf"
    class="overflow-hidden rounded-lg border border-(--ui-border) bg-(--ui-bg-elevated)"
  >
    <div class="flex items-center gap-2 px-2.5 py-2">
      <UIcon name="i-lucide-history" class="size-3.5 text-(--ui-text-muted)" />
      <span class="flex-1 text-sm font-medium">{{ ausgabe?.prozess?.split(':').pop() ?? t('ai.tools.showJob') }}</span>
      <JobStatusBadge v-if="ausgabe?.status" :status="ausgabe.status" :progress="ausgabe.fortschritt" />
    </div>
    <div class="space-y-1.5 border-t border-(--ui-border) px-2.5 py-2.5">
      <p v-if="ausgabe?.dauer" class="text-xs text-(--ui-text-muted)">
        {{ t('jobs.duration') }}: {{ ausgabe.dauer }}
      </p>
      <p v-for="zeile in ergebniszeilen" :key="zeile" class="text-xs text-(--ui-text-dimmed)">
        {{ zeile }}
      </p>
      <p v-if="ausgabe?.ergebnisFehler" class="text-xs text-(--ui-text-muted)">
        {{ t('jobs.resultError') }}
      </p>
      <UButton
        v-if="ausgabe?.link"
        :to="ausgabe.link"
        variant="subtle"
        size="xs"
        class="mt-1"
        @click="emit('geoeffnet')"
      >
        {{ t('ai.tools.openJob') }}
      </UButton>
    </div>
  </div>

  <UChatTool
    v-else
    :text="beschriftung"
    :suffix="zusatz"
    :icon="symbol"
    :loading="teil.zustand === 'laeuft'"
  >
    <div class="space-y-1">
      <p class="text-xs text-(--ui-text-muted)">
        {{ t('ai.tools.sentToProvider') }}
      </p>
      <pre class="max-h-64 overflow-auto whitespace-pre-wrap break-all text-xs text-(--ui-text-dimmed)">{{ inhalt }}</pre>
    </div>
  </UChatTool>
</template>
