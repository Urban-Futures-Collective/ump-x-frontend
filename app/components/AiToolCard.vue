<script setup lang="ts">
// One tool call in the chat. Expanded, a generic card shows exactly what was sent
// to the user's model provider.
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
  fehlend?: string[]
  unbekannt?: string[]
  prozess?: string
  status?: JobStatus
  fortschritt?: number
  dauer?: string
  ergebnis?: ErgebnisZusammenfassung
  ergebnisFehler?: string
}
const ausgabe = computed(() => props.teil.ausgabe as Ausgabe | undefined)

const gelungen = computed(() => props.teil.zustand === 'fertig' && !ausgabe.value?.fehler)

// Detected by tool name, not by the presence of a link: several tools return links.
const vorbereitet = computed(() => props.teil.name === 'prepareRun' && gelungen.value)
const lauf = computed(() => props.teil.name === 'showJob' && gelungen.value)

// The result summary as readable lines; the extent is shown as two corners
// rather than four bare numbers.
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
  // An unknown tool shows its name instead of the raw i18n key.
  return uebersetzt === schluessel ? props.teil.name : uebersetzt
})

// "fertig" only means the tool answered. Tools return errors as a field instead
// of throwing (see useUmpTools), so check it to avoid a checkmark on an error.
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

// Recognised inputs as readable lines instead of raw JSON.
const erkannt = computed(() => {
  const e = ausgabe.value?.eingaben
  if (!e || Array.isArray(e)) return []
  return Object.entries(e).map(([k, v]) => `${k} = ${String(v)}`)
})

// Required inputs the model did not provide, and names the process does not know.
const fehlend = computed(() => ausgabe.value?.fehlend ?? [])
const unbekannt = computed(() => ausgabe.value?.unbekannt ?? [])
const unvollstaendig = computed(() => fehlend.value.length > 0)

const inhalt = computed(() => JSON.stringify(props.teil.ausgabe ?? props.teil.eingabe ?? {}, null, 2))
</script>

<template>
  <div
    v-if="vorbereitet"
    class="overflow-hidden rounded-lg border bg-(--ui-bg-elevated)"
    :class="unvollstaendig ? 'border-(--ui-warning)' : 'border-(--ui-primary)'"
  >
    <div class="flex items-center gap-2 px-2.5 py-2">
      <UIcon
        :name="unvollstaendig ? 'i-lucide-circle-alert' : 'i-lucide-play'"
        class="size-3.5"
        :class="unvollstaendig ? 'text-(--ui-warning)' : 'text-(--ui-primary)'"
      />
      <span class="flex-1 text-sm font-medium">{{ t('ai.tools.prepareRun') }}</span>
      <span class="text-xs text-(--ui-text-dimmed)">{{ (teil.eingabe as { processId?: string })?.processId?.split(':').pop() }}</span>
    </div>
    <div class="space-y-1.5 border-t border-(--ui-border) px-2.5 py-2.5">
      <p v-if="erkannt.length" class="text-xs text-(--ui-text-muted)">
        {{ t('ai.tools.recognised') }}
      </p>
      <p v-for="zeile in erkannt" :key="zeile" class="text-xs text-(--ui-text-dimmed)">
        {{ zeile }}
      </p>
      <!-- Missing inputs go above the button so they are read before clicking through. -->
      <p v-if="fehlend.length" class="text-xs font-medium text-(--ui-warning)">
        {{ t('ai.tools.missing', { liste: fehlend.join(', ') }) }}
      </p>
      <p v-if="unbekannt.length" class="text-xs text-(--ui-text-muted)">
        {{ t('ai.tools.unknown', { liste: unbekannt.join(', ') }) }}
      </p>
      <UButton :to="ausgabe?.link" size="xs" class="mt-1" @click="emit('geoeffnet')">
        {{ t('ai.tools.openForm') }}
      </UButton>
      <p class="text-xs text-(--ui-text-dimmed)">
        {{ t('ai.tools.startedByYou') }}
      </p>
    </div>
  </div>

  <!-- A shown job is information, not a proposal: no start button, just a link to
       its page (map and download). The summary is all the model received too. -->
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
