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
//
// Das Schaufenster folgt seit dem 2026-09-18 dem Figma-Entwurf „Startseite,
// Alternative B". Zwei Dinge daran sind Absicht und keine Nachlässigkeit:
// Flächen und Knöpfe haben keine abgerundeten Ecken (nur die Badges), und der
// Verlauf trägt nicht mehr die ganze Kopfzone, sondern nur noch den Kasten mit
// dem Beispielnetz. Der aufgehaltene Zustand ist vom Entwurf nicht abgedeckt
// und deshalb unverändert geblieben.
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
const { data: ausfuehrbar } = useUmpRunnableProcesses()

const schritte = ['choose', 'configure', 'take'] as const

// Schmal zeigt der Entwurf ein Menü statt der ausgeschriebenen Kopf-Aktionen.
// Es enthält genau dasselbe, damit es keinen zweiten Satz Einstiege gibt, die
// auseinanderlaufen können.
const menue = computed(() => [
  locales.value.map(loc => ({
    label: loc.code.toUpperCase(),
    checked: loc.code === locale.value,
    type: 'checkbox' as const,
    onSelect: () => setLocale(loc.code),
  })),
  [{ label: t('auth.login'), icon: 'i-lucide-log-in', onSelect: () => login() }],
])
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
  <div v-else class="flex min-h-svh flex-col bg-white">
    <header class="px-6 py-6 sm:px-16">
      <div class="mx-auto flex max-w-7xl items-center justify-between">
        <div class="flex items-center gap-3">
          <img
            src="~/assets/images/logo.svg"
            alt=""
            class="size-8"
            width="32"
            height="32"
          >
          <span class="text-lg font-semibold text-(--ui-text)">{{ t('app.title') }}</span>
        </div>

        <div class="hidden items-center gap-5 sm:flex">
          <div class="flex items-center gap-1 text-sm font-medium text-(--ui-text-muted)">
            <template v-for="(loc, i) in locales" :key="loc.code">
              <span v-if="i > 0">/</span>
              <button
                type="button"
                class="cursor-pointer"
                :class="loc.code === locale ? 'text-(--ui-text)' : 'hover:text-(--ui-text)'"
                @click="setLocale(loc.code)"
              >
                {{ loc.code.toUpperCase() }}
              </button>
            </template>
          </div>
          <ULink class="text-sm font-medium text-(--ui-primary)" @click="login()">
            {{ t('auth.login') }}
          </ULink>
        </div>

        <UDropdownMenu :items="menue" class="sm:hidden">
          <UButton
            icon="i-lucide-menu"
            color="neutral"
            variant="ghost"
            :aria-label="t('app.title')"
          />
        </UDropdownMenu>
      </div>
    </header>

    <!-- Kopfzone. Links der Text, rechts ein echter growbike-Lauf für Oelde,
         aus dem Ergebnis-GeoJSON gezeichnet. Deshalb steht der Nachweis
         darunter, und deshalb gibt es kein Symbolbild. -->
    <section class="px-6 py-14 sm:px-16 lg:py-22">
      <div class="mx-auto flex max-w-7xl flex-col items-center gap-12 lg:flex-row lg:justify-between lg:gap-16">
        <div class="w-full space-y-6 lg:max-w-[480px]">
          <h1 class="text-4xl/[1.18] font-semibold text-ufc-slate-900 sm:text-[2.75rem]/[1.18]">
            {{ t('start.hero.heading') }}
          </h1>
          <p class="text-[0.9375rem]/[1.65] text-(--ui-text)">
            {{ t('start.hero.lead') }}
          </p>
          <div class="flex flex-wrap gap-3">
            <UButton
              to="/models"
              size="lg"
              color="neutral"
              class="rounded-none bg-ufc-slate-900 px-6 py-3.5 font-medium text-white hover:bg-ufc-slate-800"
            >
              {{ t('start.hero.browse') }}
            </UButton>
            <UButton
              size="lg"
              color="neutral"
              variant="outline"
              class="rounded-none px-6 py-3.5 font-medium text-ufc-slate-900 ring-ufc-logo-gold hover:bg-ufc-gold-50"
              @click="login()"
            >
              {{ t('auth.login') }}
            </UButton>
          </div>
        </div>

        <figure class="w-full space-y-3 lg:w-[560px] lg:shrink-0">
          <!-- Die Datei ist quadratisch (600 × 600) und zeichnet das Netz mit Rand.
               Der Entwurf zeigt es hochkant, 349 × 464. Deshalb auf breiten
               Schirmen über die Höhe skaliert statt über die Breite: dann füllt
               das Netz den Kasten so wie dort, ohne dass die Datei verzerrt wird. -->
          <div class="flex items-center justify-center border border-ufc-slate-900 bg-[linear-gradient(125deg,var(--color-ufc-logo-teal)_10%,var(--color-ufc-logo-gold)_76.667%)] p-8">
            <img
              src="~/assets/images/beispiel-growbike-oelde.svg"
              alt=""
              class="w-full max-w-[350px] lg:h-[464px] lg:w-auto lg:max-w-full"
              width="600"
              height="600"
            >
          </div>
          <figcaption class="text-center text-xs text-(--ui-text-muted) opacity-80">
            {{ t('start.hero.credit') }}
          </figcaption>
        </figure>
      </div>
    </section>

    <section class="px-6 pb-22 sm:px-16">
      <div class="mx-auto max-w-7xl">
        <div class="space-y-2.5">
          <div class="inline-flex flex-col items-start">
            <h2 class="text-2xl font-semibold text-ufc-slate-900">
              {{ t('start.models.heading') }}
            </h2>
            <div class="h-[3px] w-full bg-ufc-gold-400" />
          </div>
          <p class="max-w-[680px] text-[0.9375rem] text-(--ui-text)">
            {{ t('start.models.lead') }}
          </p>
        </div>

        <ul class="grid gap-6 pt-6 sm:grid-cols-2 xl:grid-cols-4">
          <li
            v-for="p in prozesse"
            :key="p.id"
            class="flex flex-col items-start gap-3 bg-ufc-gold-400 p-5"
          >
            <h3 class="font-medium text-ufc-slate-900">
              {{ p.title }}
            </h3>
            <p class="flex-1 text-sm text-ufc-slate-700">
              {{ p.description }}
            </p>
            <span
              class="rounded-full px-2.5 py-1 text-xs"
              :class="ausfuehrbar.includes(p.id) ? 'bg-green-50 text-green-700' : 'bg-white text-ufc-slate-700'"
            >
              {{ ausfuehrbar.includes(p.id) ? t('start.models.open') : t('start.models.needsLogin') }}
            </span>
          </li>
        </ul>
      </div>
    </section>

    <section class="px-6 pb-22 sm:px-16">
      <div class="mx-auto max-w-7xl">
        <div class="inline-flex flex-col items-start">
          <h2 class="text-2xl font-semibold text-ufc-slate-900">
            {{ t('start.steps.heading') }}
          </h2>
          <div class="h-[3px] w-full bg-ufc-teal-700" />
        </div>

        <ol class="grid gap-6 pt-4 md:grid-cols-3">
          <li
            v-for="(schritt, i) in schritte"
            :key="schritt"
            class="space-y-2.5 py-6 md:pr-6"
          >
            <span class="inline-block bg-ufc-teal-700 pl-1 pr-4 text-lg/7 font-semibold text-white">
              {{ i + 1 }}
            </span>
            <h3 class="font-medium text-(--ui-text)">
              {{ t(`start.steps.${schritt}.title`) }}
            </h3>
            <p class="text-sm text-(--ui-text-muted)">
              {{ t(`start.steps.${schritt}.body`) }}
            </p>
          </li>
        </ol>
      </div>
    </section>

    <!-- Die zwei Wege nebeneinander. Einzeln wirkt jeder wie eine Hürde,
         zusammen sagen sie, was das Projekt anbietet: wir verkaufen keine KI,
         du bringst deine eigene mit.
         Hier steht bewusst keine Eingabezeile mehr: chatten kann nur, wer
         angemeldet ist, und ein Feld, das erst zur Anmeldung führt, verspricht
         mehr als es hält. Die Adresse des MCP-Servers steht ebenfalls nicht da,
         sondern auf der Hilfeseite, wo danebensteht, was sie ist. -->
    <section class="px-6 pb-24 sm:px-16">
      <div class="mx-auto max-w-7xl">
        <div class="space-y-2.5">
          <div class="inline-flex flex-col items-start">
            <h2 class="text-2xl font-semibold text-ufc-slate-900">
              {{ t('start.ai.heading') }}
            </h2>
            <div class="h-[3px] w-full bg-ufc-logo-plum" />
          </div>
          <p class="max-w-[680px] text-[0.9375rem] text-(--ui-text)">
            {{ t('start.ai.lead') }}
          </p>
        </div>

        <div class="grid gap-6 pt-4 md:grid-cols-2">
          <div class="relative space-y-3 bg-white py-1 pl-8 pr-8">
            <div class="absolute inset-y-0 left-0 w-[3px] bg-ufc-logo-plum" />
            <div class="flex items-center gap-2">
              <UIcon name="i-lucide-sparkles" class="size-5 text-ufc-logo-plum" />
              <h3 class="text-lg font-medium text-ufc-slate-900">
                {{ t('start.ai.chat.heading') }}
              </h3>
            </div>
            <p class="text-[0.9375rem]/[1.6] text-(--ui-text)">
              {{ t('start.ai.chat.body') }}
            </p>
            <p class="text-[0.8125rem] text-(--ui-text-muted)">
              {{ t('start.ai.chat.hint') }}
            </p>
          </div>

          <div class="relative space-y-3 bg-white py-1 pl-8 pr-8">
            <div class="absolute inset-y-0 left-0 w-[3px] bg-ufc-logo-plum" />
            <div class="flex items-center gap-2">
              <UIcon name="i-lucide-git-fork" class="size-5 text-ufc-logo-plum" />
              <h3 class="text-lg font-medium text-ufc-slate-900">
                {{ t('start.ai.mcp.heading') }}
              </h3>
            </div>
            <p class="text-[0.9375rem]/[1.6] text-(--ui-text)">
              {{ t('start.ai.mcp.body') }}
            </p>
            <ULink to="/hilfe" class="flex items-center gap-1.5 text-[0.8125rem] text-ufc-logo-blue">
              {{ t('start.ai.mcp.more') }}
              <UIcon name="i-lucide-arrow-right" class="size-4" />
            </ULink>
          </div>
        </div>
      </div>
    </section>

    <TheFooter class="mt-auto" />
  </div>
</template>
