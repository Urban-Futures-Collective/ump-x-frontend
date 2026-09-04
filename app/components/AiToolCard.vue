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
import type { Teil } from '~/composables/useAiChat'

const props = defineProps<{ teil: Extract<Teil, { type: 'werkzeug' }> }>()
const emit = defineEmits<{ geoeffnet: [] }>()

const { t } = useI18n()

interface Ausgabe {
  fehler?: string
  modelle?: unknown[]
  eingaben?: Record<string, unknown> | unknown[]
  link?: string
}
const ausgabe = computed(() => props.teil.ausgabe as Ausgabe | undefined)

// Ein vorbereiteter Lauf ist am Link erkennbar, nicht am Werkzeugnamen: was
// einen Link auf das Formular liefert, bekommt den Knopf.
const vorbereitet = computed(() => props.teil.zustand === 'fertig' && !!ausgabe.value?.link)

const beschriftung = computed(() => {
  const schluessel = `ai.tools.${props.teil.name}`
  const uebersetzt = t(schluessel)
  // Ein unbekanntes Werkzeug soll seinen Namen zeigen statt den i18n-Schlüssel.
  return uebersetzt === schluessel ? props.teil.name : uebersetzt
})

const symbol = computed(() => ({
  laeuft: 'i-lucide-wrench',
  fertig: 'i-lucide-check',
  fehler: 'i-lucide-triangle-alert',
}[props.teil.zustand]))

const zusatz = computed(() => {
  if (props.teil.zustand === 'laeuft') return t('ai.tools.running')
  if (props.teil.zustand === 'fehler' || ausgabe.value?.fehler) return t('ai.tools.failed')
  if (Array.isArray(ausgabe.value?.modelle)) return t('ai.tools.count', { n: ausgabe.value.modelle.length })
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
