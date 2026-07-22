<script setup lang="ts">
// „Administration" — Placeholder. Echter Admin-View (Mock-Adapter useUmpAccess,
// Zugriffs-Matrix) = Folge-Sprint. auth + admin-Middleware: nur mit ump_admin (bzw.
// Dev-Override) erreichbar; Reihenfolge zählt (erst Session, dann Rolle).
definePageMeta({ middleware: ['auth', 'admin'] })
const { t } = useI18n()
</script>

<template>
  <div class="mx-auto max-w-xl py-12 text-center">
    <UIcon name="i-lucide-shield" class="mx-auto mb-4 size-10 text-(--ui-text-muted)" />
    <h1 class="text-xl font-semibold">
      {{ t('admin.title') }}
    </h1>
    <p class="mt-2 text-(--ui-text-muted)">
      {{ t('common.comingSoon') }}
    </p>
  </div>
</template>
