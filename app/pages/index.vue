<script setup lang="ts">
// Landing/Router: eingeloggt → direkt zum Modell-Katalog. Ausgeloggt → kurze Landing
// mit Login-CTA; der öffentliche Katalog (/models, /run) bleibt trotzdem erreichbar.
const { t } = useI18n()
const { loggedIn, login } = useOidcAuth()

if (loggedIn.value) {
  await navigateTo('/models')
}
</script>

<template>
  <div class="mx-auto max-w-2xl space-y-8 py-12 text-center">
    <div class="space-y-3">
      <h1 class="text-3xl font-bold tracking-tight">
        {{ t('landing.heading') }}
      </h1>
      <p class="text-(--ui-text-muted)">
        {{ t('landing.subtitle') }}
      </p>
    </div>

    <div class="flex flex-wrap items-center justify-center gap-3">
      <UButton icon="i-lucide-log-in" color="primary" size="lg" @click="login()">
        {{ t('auth.login') }}
      </UButton>
      <UButton icon="i-lucide-boxes" color="neutral" variant="soft" size="lg" to="/models">
        {{ t('landing.browsePublic') }}
      </UButton>
    </div>

    <p class="text-sm text-(--ui-text-muted)">
      {{ t('landing.publicHint') }}
    </p>
  </div>
</template>
