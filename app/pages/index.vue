<script setup lang="ts">
// Startseite. Eine Route, zwei Zustände.
//
// Ohne `redirect` ist es das Schaufenster: Wer von außen kommt, soll sehen, was
// die Plattform tut, bevor er nach einem Konto gefragt wird. Der Hauptweg ist
// deshalb der Katalog, nicht die Anmeldung.
//
// Mit `redirect` wurde jemand von der auth-Middleware aufgehalten. Der wollte
// schon irgendwo hin, und dann ist ein Schaufenster die falsche Antwort. Er
// bekommt eine schmale Karte mit dem Grund und einem Hauptweg.
//
// Bis zum 2026-09-01 waren das zwei getrennte Seiten mit denselben zwei Knöpfen.
// Die Anmeldung selbst läuft über Keycloak, hier steht deshalb kein Formular für
// Kennung und Passwort: ein eigenes wäre eine Attrappe.
definePageMeta({ layout: false })

const { t, locale, locales, setLocale } = useI18n()
const route = useRoute()
const { loggedIn, login } = useOidcAuth()

// Angemeldet gehört niemand auf die Startseite, der Katalog ist der Arbeitsplatz.
if (loggedIn.value) {
  await navigateTo('/models')
}

const aufgehalten = computed(() => typeof route.query.redirect === 'string' && route.query.redirect !== '')

// Die echten Modelle statt einer gepflegten Liste: was im Katalog steht, steht
// auch hier. Bewusst unbedingt aufgerufen, auch im aufgehaltenen Zustand: ein
// Composable hinter einer Bedingung bricht die Reihenfolge der Aufrufe, und beide
// Abfragen sind öffentlich und klein.
const { data: prozesse } = useUmpProcesses()
const { data: offene } = useUmpOpenProcesses()

const schritte = ['choose', 'configure', 'take'] as const
</script>

<template>
  <!-- Aufgehalten: schmale Karte auf dem Verlauf, ein Hauptweg. -->
  <NuxtLayout v-if="aufgehalten" name="auth">
    <div class="space-y-5 text-center">
      <img
        src="~/assets/images/logo.svg"
        alt=""
        class="mx-auto size-12"
        width="48"
        height="48"
      >
      <div class="space-y-2">
        <h1 class="text-xl font-semibold text-(--ui-text-highlighted)">
          {{ t('start.blocked.heading') }}
        </h1>
        <p class="text-sm text-(--ui-text-muted)">
          {{ t('start.blocked.reason') }}
        </p>
      </div>

      <UButton icon="i-lucide-log-in" color="primary" size="lg" block @click="login()">
        {{ t('auth.login') }}
      </UButton>
      <p class="text-xs text-(--ui-text-dimmed)">
        {{ t('start.keycloakHint') }}
      </p>

      <!-- Nur ein Textlink, kein zweiter gleichwertiger Knopf: wer aufgehalten
           wurde, wollte woanders hin als in den Katalog. -->
      <ULink to="/models" class="block text-sm font-medium text-(--ui-primary)">
        {{ t('start.blocked.orBrowse') }}
      </ULink>
    </div>
  </NuxtLayout>

  <!-- Schaufenster -->
  <div v-else class="flex min-h-svh flex-col bg-(--ui-bg)">
    <header class="flex items-center justify-between px-6 py-5 sm:px-16">
      <div class="flex items-center gap-3">
        <img
          src="~/assets/images/logo.svg"
          alt=""
          class="size-8"
          width="32"
          height="32"
        >
        <span class="text-lg font-semibold text-(--ui-text-highlighted)">{{ t('app.title') }}</span>
      </div>
      <div class="flex items-center gap-4">
        <div class="flex items-center gap-1">
          <UButton
            v-for="loc in locales"
            :key="loc.code"
            :variant="loc.code === locale ? 'solid' : 'ghost'"
            :color="loc.code === locale ? 'primary' : 'neutral'"
            size="xs"
            @click="setLocale(loc.code)"
          >
            {{ loc.code.toUpperCase() }}
          </UButton>
        </div>
        <ULink class="text-sm font-medium text-(--ui-primary)" @click="login()">
          {{ t('auth.login') }}
        </ULink>
      </div>
    </header>

    <section class="bg-linear-to-br from-ufc-teal-500 to-ufc-gold-400 px-6 py-16 text-white sm:px-16">
      <div class="mx-auto flex max-w-7xl flex-col items-center gap-10 lg:flex-row lg:gap-16">
        <div class="flex-1 space-y-6">
          <h1 class="text-3xl font-semibold leading-tight sm:text-4xl">
            {{ t('start.hero.heading') }}
          </h1>
          <p class="max-w-xl text-base/relaxed text-white/90">
            {{ t('start.hero.lead') }}
          </p>
          <div class="flex flex-wrap gap-3">
            <UButton to="/models" color="neutral" size="lg" icon="i-lucide-grid-3x3" class="bg-white text-(--ui-primary) hover:bg-white/90">
              {{ t('start.hero.browse') }}
            </UButton>
            <UButton color="neutral" variant="ghost" size="lg" icon="i-lucide-log-in" class="bg-transparent text-white ring-1 ring-inset ring-white hover:bg-white/10 hover:text-white" @click="login()">
              {{ t('auth.login') }}
            </UButton>
          </div>
          <p class="text-xs text-white/80">
            {{ t('start.keycloakHint') }}
          </p>
          <p class="text-xs text-white/80">
            {{ t('start.hero.accessHint') }}
          </p>
        </div>

        <!-- Kein Symbolbild: ein echter growbike-Lauf für Oelde, aus dem
             Ergebnis-GeoJSON gezeichnet. Deshalb steht der Nachweis darunter. -->
        <figure class="w-full max-w-sm shrink-0 lg:w-96">
          <img
            src="~/assets/images/beispiel-growbike-oelde.svg"
            alt=""
            class="w-full opacity-90"
            width="384"
            height="384"
          >
          <figcaption class="mt-2 text-center text-xs text-white/80">
            {{ t('start.hero.credit') }}
          </figcaption>
        </figure>
      </div>
    </section>

    <section class="px-6 py-16 sm:px-16">
      <div class="mx-auto max-w-7xl space-y-8">
        <h2 class="text-2xl font-semibold text-(--ui-text-highlighted)">
          {{ t('start.steps.heading') }}
        </h2>
        <ol class="grid gap-6 md:grid-cols-3">
          <li
            v-for="(schritt, i) in schritte"
            :key="schritt"
            class="space-y-2 rounded-xl bg-(--ui-bg-elevated) p-6"
          >
            <span class="block text-lg font-semibold text-ufc-teal-600">{{ i + 1 }}</span>
            <h3 class="font-medium text-(--ui-text-highlighted)">
              {{ t(`start.steps.${schritt}.title`) }}
            </h3>
            <p class="text-sm text-(--ui-text-muted)">
              {{ t(`start.steps.${schritt}.body`) }}
            </p>
          </li>
        </ol>
      </div>
    </section>

    <section class="bg-(--ui-bg-elevated) px-6 py-16 sm:px-16">
      <div class="mx-auto max-w-7xl space-y-2">
        <h2 class="text-2xl font-semibold text-(--ui-text-highlighted)">
          {{ t('start.models.heading') }}
        </h2>
        <p class="text-(--ui-text-muted)">
          {{ t('start.models.lead') }}
        </p>
        <ul class="grid gap-5 pt-6 md:grid-cols-2 xl:grid-cols-4">
          <li
            v-for="p in prozesse"
            :key="p.id"
            class="flex flex-col gap-3 rounded-xl border border-(--ui-border) bg-(--ui-bg) p-5"
          >
            <h3 class="font-medium text-(--ui-text-highlighted)">
              {{ p.title }}
            </h3>
            <p class="flex-1 text-sm text-(--ui-text-muted)">
              {{ p.description }}
            </p>
            <UBadge
              :color="offene.includes(p.id) ? 'success' : 'neutral'"
              variant="subtle"
              size="sm"
              class="self-start"
            >
              {{ offene.includes(p.id) ? t('start.models.open') : t('start.models.needsLogin') }}
            </UBadge>
          </li>
        </ul>
      </div>
    </section>

    <TheFooter class="mt-auto" />
  </div>
</template>
