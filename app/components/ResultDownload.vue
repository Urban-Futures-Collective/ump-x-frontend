<script setup lang="ts">
// Ergebnis eines Laufs herunterladen.
//
// Bewusst ein Anker auf den Proxy-Pfad statt eines Blobs aus dem, was die Seite
// ohnehin schon geparst hat. Rico hat das am 2026-08-31 so entschieden: die
// Antwort der API wird durchgereicht, „der Download ist dann einfach nur der
// reine Dateidownload (und damit abhängig vom Modell, was als Datensatz zurück
// kommt)". Das trägt auch dort noch, wo unsere Karte nichts zeichnen kann.
//
// Der Pfad ist gleiche Herkunft (der Proxy steht davor), deshalb nimmt der
// Browser das download-Attribut an und die Session-Cookies gehen mit.
const props = defineProps<{ jobId: string, processId?: string }>()

const { t } = useI18n()
const { base } = useUmpBase()

// Der Name muss im Downloads-Ordner ohne weiteren Kontext zuzuordnen sein. Der
// Stadtname wäre schöner, steht uns aber nicht zur Verfügung: die Eingaben eines
// Laufs liefert die Job-Antwort nicht mit, und laut Rico müssen sie auch nicht in
// die Datei.
const basisname = computed(() => {
  const prozess = (props.processId ?? 'ergebnis').split(':').pop() ?? 'ergebnis'
  return `${prozess}_${props.jobId.slice(0, 8)}`
})

// Ohne Endung an den Proxy: die kennt hier niemand, der Knopf wird geklickt bevor
// jemand die Antwort gesehen hat. Der Proxy hängt sie an, sobald er den
// Content-Type kennt, und setzt daraus ein Content-Disposition. Siehe
// server/routes/ump/[...path].ts.
const href = computed(() =>
  `${base}/jobs/${props.jobId}/results?filename=${encodeURIComponent(basisname.value)}`,
)

// Rückfall für den Fall, dass kein Content-Disposition ankommt: dann gilt dieses
// Attribut, und .geojson ist für die vier heutigen Modelle richtig. Kommt der Kopf,
// gewinnt er, und die Endung stimmt auch bei einem Modell, das etwas anderes liefert.
const rueckfall = computed(() => `${basisname.value}.geojson`)
</script>

<template>
  <UButton
    :to="href"
    :download="rueckfall"
    external
    variant="subtle"
    size="sm"
    icon="i-lucide-download"
  >
    {{ t('jobs.download') }}
  </UButton>
</template>
