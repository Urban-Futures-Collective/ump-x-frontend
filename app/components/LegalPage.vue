<script setup lang="ts">
// Frame for the legal pages (privacy, legal notice, accessibility). The texts are German,
// as German law requires them; in English a short note says so. While a text is a draft,
// a notice says so and missing facts are marked in the text.
defineProps<{ title: string, draft?: boolean }>()
const { t, locale } = useI18n()
</script>

<template>
  <article class="legal mx-auto max-w-3xl space-y-6">
    <h1 class="text-2xl font-semibold text-ufc-slate-900">
      {{ title }}
    </h1>
    <UAlert
      v-if="draft"
      color="warning"
      variant="subtle"
      icon="i-lucide-file-pen"
      :title="t('legal.draftTitle')"
      :description="t('legal.draftText')"
    />
    <p v-if="locale !== 'de'" class="text-sm text-(--ui-text-muted)" lang="en">
      {{ t('legal.germanOnly') }}
    </p>
    <div lang="de" class="space-y-6 text-sm leading-relaxed">
      <slot />
    </div>
  </article>
</template>

<style scoped>
.legal :deep(h2) { font-size: 1.125rem; font-weight: 600; margin-bottom: 0.5rem; }
.legal :deep(h3) { font-weight: 600; margin-bottom: 0.25rem; }
.legal :deep(ul) { list-style: disc; padding-left: 1.25rem; }
.legal :deep(.gap) { background: var(--ui-color-warning-100, #fef3c7); padding: 0 0.25rem; border-radius: 0.25rem; }
</style>
