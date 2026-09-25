<script setup lang="ts">
// Eine Kachel pro Modell, wie im Entwurf „Landing Screen“: Titel, Beschreibung,
// darunter Platz für einen Vermerk. Die ganze Kachel ist der Link, damit man
// nicht erst die Überschrift treffen muss.
//
// Der Vermerk („ohne Anmeldung ausführbar“) steht im Entwurf, fehlt hier aber
// bewusst: UMP sagt nicht, ob ein Modell ohne Anmeldung läuft, und geraten wäre
// er schlimmer als gar keiner. Der Slot ist für den Tag, an dem UMP es sagt.
defineProps<{
  title: string
  description?: string
  to: string | { path: string, query?: Record<string, string> }
}>()
</script>

<template>
  <ULink
    :to="to"
    class="flex h-full flex-col gap-3 bg-white p-6 transition-shadow hover:shadow-md focus-visible:outline-2 focus-visible:outline-(--ui-primary)"
  >
    <h3 class="text-lg font-medium text-ufc-slate-900">
      {{ title }}
    </h3>
    <p v-if="description" class="flex-1 text-[0.9375rem]/[1.6] text-ufc-slate-700">
      {{ description }}
    </p>
    <slot name="badge" />
  </ULink>
</template>
