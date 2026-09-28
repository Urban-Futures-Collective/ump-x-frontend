<script setup lang="ts">
// Ein Modell, in zwei Formen aus den Entwürfen: als Kachel („Landing Screen“)
// und als Zeile („Models list“, mit Kennung und Pfeil). Die ganze Fläche ist der
// Link, damit man nicht erst die Überschrift treffen muss.
//
// Der Vermerk („ohne Anmeldung ausführbar“) steht im Entwurf, fehlt hier aber
// bewusst: UMP sagt nicht, ob ein Modell ohne Anmeldung läuft, und geraten wäre
// er schlimmer als gar keiner. Der Slot ist für den Tag, an dem UMP es sagt.
//
// `gold` ist die Kachel der Startseite: dort steht sie auf Weiß und bräuchte
// sonst einen Rahmen, den der Entwurf nicht hat.
withDefaults(defineProps<{
  title: string
  description?: string
  processId?: string
  to: string | { path: string, query?: Record<string, string> }
  layout?: 'tile' | 'row'
  tone?: 'white' | 'gold'
}>(), { description: undefined, processId: undefined, layout: 'tile', tone: 'white' })
</script>

<template>
  <ULink
    v-if="layout === 'row'"
    :to="to"
    class="flex items-center justify-between gap-4 border border-(--ui-border) bg-white px-4 py-3 transition-shadow hover:shadow-md focus-visible:outline-2 focus-visible:outline-(--ui-primary)"
  >
    <span class="min-w-0 space-y-0.5">
      <span class="block font-medium text-ufc-slate-900">{{ title }}</span>
      <span v-if="description" class="block text-sm text-ufc-slate-700">{{ description }}</span>
      <span v-if="processId" class="block text-xs text-(--ui-text-muted)">{{ processId }}</span>
    </span>
    <span class="flex shrink-0 items-center gap-3">
      <slot name="badge" />
      <UIcon name="i-lucide-arrow-right" class="size-4 text-(--ui-text-muted)" />
    </span>
  </ULink>

  <ULink
    v-else
    :to="to"
    class="flex h-full flex-col gap-3 p-6 transition-shadow hover:shadow-md focus-visible:outline-2 focus-visible:outline-(--ui-primary)"
    :class="tone === 'gold' ? 'bg-ufc-gold-400' : 'bg-white'"
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
