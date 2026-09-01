<script setup lang="ts">
// Fußzeile. Trägerangaben links, rechtliche Verweise rechts.
//
// Barrierefreiheit steht bewusst mit drin: als öffentlich gefördertes Angebot
// gehört die Erklärung dazu, und wer sie erst spät einplant, baut sie nie.
// Die Ziele sind noch Platzhalter, die Seiten gibt es nicht.
const { t } = useI18n()

const rechtliches = [
  { key: 'openSource', to: 'https://github.com/Urban-Futures-Collective/ump-x-frontend', extern: true },
  { key: 'privacy', to: '/datenschutz', extern: false },
  { key: 'imprint', to: '/impressum', extern: false },
  { key: 'accessibility', to: '/barrierefreiheit', extern: false },
] as const
</script>

<template>
  <footer class="border-t border-(--ui-border) bg-(--ui-bg-elevated) px-6 py-6 sm:px-16">
    <div class="mx-auto flex max-w-7xl flex-col gap-3 text-xs text-(--ui-text-muted) sm:flex-row sm:items-center sm:justify-between">
      <p>{{ t('footer.carriers') }}</p>
      <ul class="flex flex-wrap items-center gap-4">
        <li v-for="eintrag in rechtliches" :key="eintrag.key">
          <ULink
            :to="eintrag.to"
            :external="eintrag.extern"
            :target="eintrag.extern ? '_blank' : undefined"
            class="hover:text-(--ui-text)"
          >
            {{ t(`footer.${eintrag.key}`) }}
          </ULink>
        </li>
      </ul>
    </div>
  </footer>
</template>
