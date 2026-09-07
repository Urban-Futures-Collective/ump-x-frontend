<script setup lang="ts">
// Anmeldebildschirm nach dem Wireframe: Farbverlauf über die ganze Fläche,
// die Karte mittig darüber. Petrol oben nach Gold unten, mit den Werten der
// Logo-Tafel (siehe --color-ufc-logo-* in main.css). Senkrecht, weil die
// Anmeldebildschirme im Wireframe so laufen; der Hero ist diagonal.
const { t, locale, locales, setLocale } = useI18n()
</script>

<template>
  <div class="relative flex min-h-svh items-center justify-center bg-linear-to-b from-ufc-logo-teal to-ufc-logo-gold p-4">
    <div class="absolute right-4 top-4 flex items-center gap-1">
      <UButton
        v-for="loc in locales"
        :key="loc.code"
        :variant="loc.code === locale ? 'solid' : 'ghost'"
        color="neutral"
        size="xs"
        class="bg-white/80 text-(--ui-text) hover:bg-white"
        @click="setLocale(loc.code)"
      >
        {{ loc.code.toUpperCase() }}
      </UButton>
    </div>

    <div class="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl sm:p-10">
      <slot />
    </div>

    <p class="absolute bottom-4 text-xs text-white/80">
      {{ t('app.title') }}
    </p>
  </div>
</template>
