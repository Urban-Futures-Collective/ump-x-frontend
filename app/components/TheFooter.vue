<script setup lang="ts">
// Footer: operator info on the left, legal links on the right. In the workspace the
// partners are already in the sidebar (logos), so there it shows only the links and
// stays slim (`compact`).
//
// The accessibility statement is included on purpose, as it is easiest to plan
// for from the start. The targets are placeholders; the pages do not exist yet.
withDefaults(defineProps<{ compact?: boolean }>(), { compact: false })
const { t } = useI18n()

const legalLinks = [
  { key: 'openSource', to: 'https://github.com/Urban-Futures-Collective/ump-x-frontend', external: true },
  { key: 'privacy', to: '/datenschutz', external: false },
  { key: 'imprint', to: '/impressum', external: false },
  { key: 'accessibility', to: '/barrierefreiheit', external: false },
] as const
</script>

<template>
  <footer
    class="border-t border-(--ui-border) bg-(--ui-bg-elevated)"
    :class="compact ? 'px-6 py-3 sm:px-8' : 'px-6 py-6 sm:px-16'"
  >
    <div
      class="flex flex-col gap-3 text-xs text-(--ui-text-muted) sm:flex-row sm:items-center"
      :class="compact ? 'sm:justify-end' : 'mx-auto max-w-7xl sm:justify-between'"
    >
      <p v-if="!compact">
        {{ t('footer.carriers') }}
      </p>
      <ul class="flex flex-wrap items-center gap-4">
        <li v-for="entry in legalLinks" :key="entry.key">
          <ULink
            :to="entry.to"
            :external="entry.external"
            :target="entry.external ? '_blank' : undefined"
            class="hover:text-(--ui-text)"
          >
            {{ t(`footer.${entry.key}`) }}
          </ULink>
        </li>
      </ul>
    </div>
  </footer>
</template>
