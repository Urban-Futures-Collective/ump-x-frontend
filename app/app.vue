<script setup lang="ts">
const { t, locale, locales, setLocale } = useI18n()
const colorMode = useColorMode()

const availableLocales = computed(() => locales.value)

function toggleColorMode() {
  colorMode.preference = colorMode.value === 'dark' ? 'light' : 'dark'
}
</script>

<template>
  <UApp>
    <UHeader :title="t('app.title')">
      <template #right>
        <!-- Sprachumschalter DE/EN (Cookie-basiert, no_prefix) -->
        <div class="flex items-center gap-1">
          <UButton
            v-for="loc in availableLocales"
            :key="loc.code"
            :variant="loc.code === locale ? 'solid' : 'ghost'"
            color="neutral"
            size="xs"
            @click="setLocale(loc.code)"
          >
            {{ loc.code.toUpperCase() }}
          </UButton>
        </div>

        <!-- Color-Mode-Toggle -->
        <ClientOnly>
          <UButton
            :icon="colorMode.value === 'dark' ? 'i-lucide-moon' : 'i-lucide-sun'"
            :aria-label="t('colorMode.toggle')"
            color="neutral"
            variant="ghost"
            @click="toggleColorMode"
          />
          <template #fallback>
            <div class="size-8" />
          </template>
        </ClientOnly>
      </template>
    </UHeader>

    <UMain>
      <UContainer class="py-8">
        <!-- Leerer Inhaltsbereich. Views kommen mit den Folge-Sprints. -->
        <p class="text-(--ui-text-muted)">
          {{ t('app.placeholder') }}
        </p>
      </UContainer>
    </UMain>
  </UApp>
</template>
