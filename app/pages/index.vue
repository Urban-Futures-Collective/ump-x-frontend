<script setup lang="ts">
// Einstieg. Eingeloggt geht es direkt in den Katalog, abgemeldet erscheint der
// Anmeldebildschirm. Die Anmeldung selbst läuft über Keycloak, deshalb steht
// hier kein Formular für Kennung und Passwort, sondern der Weg dorthin. Ein
// eigenes Formular wäre eine Attrappe und würde Zugangsdaten an der falschen
// Stelle abfragen.
definePageMeta({ layout: 'auth' })

const { t } = useI18n()
const { loggedIn, login } = useOidcAuth()

if (loggedIn.value) {
  await navigateTo('/models')
}
</script>

<template>
  <div class="space-y-6 text-center">
    <div class="space-y-3">
      <img
        src="~/assets/images/logo.svg"
        alt=""
        class="mx-auto size-14"
        width="56"
        height="56"
      >
      <h1 class="text-2xl font-semibold text-(--ui-text-highlighted)">
        {{ t('landing.heading') }}
      </h1>
      <p class="text-sm text-(--ui-text-muted)">
        {{ t('landing.subtitle') }}
      </p>
    </div>

    <UButton icon="i-lucide-log-in" color="primary" size="lg" block @click="login()">
      {{ t('auth.login') }}
    </UButton>

    <div class="flex items-center gap-3">
      <USeparator class="flex-1" />
      <span class="text-xs text-(--ui-text-dimmed)">{{ t('landing.or') }}</span>
      <USeparator class="flex-1" />
    </div>

    <UButton icon="i-lucide-grid-3x3" color="neutral" variant="outline" size="lg" block to="/models">
      {{ t('landing.browsePublic') }}
    </UButton>

    <p class="text-xs text-(--ui-text-muted)">
      {{ t('landing.publicHint') }}
    </p>
  </div>
</template>
