<script setup lang="ts">
// Ein Werkzeugaufruf im Chat.
//
// Aufgeklappt zeigt die Karte, was tatsächlich an den Anbieter gegangen ist.
// Das ist kein Schmuck: unter dem Zugangsformular steht, dass Fragen und
// Werkzeug-Ergebnisse beim gewählten Anbieter landen. Ohne diese Ansicht wäre
// das eine Behauptung, die niemand nachprüfen kann.
import type { Teil } from '~/composables/useAiChat'

const props = defineProps<{ teil: Extract<Teil, { type: 'werkzeug' }> }>()

const { t } = useI18n()

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
  if (props.teil.zustand === 'fehler') return t('ai.tools.failed')
  const a = props.teil.ausgabe as { modelle?: unknown[], eingaben?: unknown[], fehler?: string } | undefined
  if (a?.fehler) return t('ai.tools.failed')
  if (Array.isArray(a?.modelle)) return t('ai.tools.count', { n: a.modelle.length })
  if (Array.isArray(a?.eingaben)) return t('ai.tools.inputs', { n: a.eingaben.length })
  return ''
})

const inhalt = computed(() => JSON.stringify(props.teil.ausgabe ?? props.teil.eingabe ?? {}, null, 2))
</script>

<template>
  <UChatTool
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
