<script setup lang="ts">
// „Meine Szenarien" — Placeholder. Echte Anbindung an GET /jobs (user-gescoped) = Folge-Sprint.
// auth-Middleware: nur für eingeloggte User erreichbar.
definePageMeta({ middleware: ['auth'] })
const { t } = useI18n()
</script>

<template>
  <div class="mx-auto max-w-xl py-12 text-center">
    <UIcon name="i-lucide-history" class="mx-auto mb-4 size-10 text-(--ui-text-muted)" />
    <h1 class="text-xl font-semibold">
      {{ t('jobs.title') }}
    </h1>
    <p class="mt-2 text-(--ui-text-muted)">
      {{ t('common.comingSoon') }}
    </p>
  </div>
</template>
