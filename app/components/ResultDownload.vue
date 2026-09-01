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

const href = computed(() => `${base}/jobs/${props.jobId}/results`)

// Muss im Downloads-Ordner ohne weiteren Kontext zuzuordnen sein. Der Stadtname
// wäre schöner, steht uns aber nicht zur Verfügung: die Eingaben eines Laufs
// liefert die Job-Antwort nicht mit, und laut Rico müssen sie auch nicht in die
// Datei.
//
// Die Endung ist eine Annahme. UMP setzt kein Content-Disposition und wir fragen
// den Content-Type nicht vorab ab, das wäre ein Request nur für den Kopf. Für die
// vier heutigen Modelle stimmt GeoJSON. Liefert ein Modellserver etwas anderes,
// fällt es beim Öffnen auf, nicht beim Herunterladen.
const dateiname = computed(() => {
  const prozess = (props.processId ?? 'ergebnis').split(':').pop() ?? 'ergebnis'
  return `${prozess}_${props.jobId.slice(0, 8)}.geojson`
})
</script>

<template>
  <UButton
    :to="href"
    :download="dateiname"
    external
    variant="subtle"
    size="sm"
    icon="i-lucide-download"
  >
    {{ t('jobs.download') }}
  </UButton>
</template>
