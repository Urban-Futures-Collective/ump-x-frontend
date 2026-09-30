<script setup lang="ts">
// Landing page. One route, two states.
//
// Without `redirect` it is the showcase: visitors should see what the platform
// does before being asked for an account, so the main path is the catalog, not
// sign-in.
//
// With `redirect` the auth middleware stopped someone on their way elsewhere,
// and a showcase is the wrong answer. They get a narrow card with the reason
// and one main action.
//
// Sign-in runs through Keycloak, so there is no username/password form here:
// a custom one would be a dummy.
//
// The showcase follows the Figma design "Startseite, Alternative B". Two things
// are intentional: surfaces and buttons have no rounded corners (only badges),
// and the gradient covers only the box with the example network, not the whole
// header. The blocked state is not covered by the design.
definePageMeta({ layout: false })

const { t, locale, locales, setLocale } = useI18n()
const route = useRoute()
const { loggedIn, login } = useOidcAuth()

// Signed-in users do not belong on the landing page; the catalog is their workspace.
if (loggedIn.value) {
  await navigateTo('/commons')
}

const blocked = computed(() => typeof route.query.redirect === 'string' && route.query.redirect !== '')

// The real models rather than a curated list: what is in the catalog is shown
// here too. Called unconditionally, also in the blocked state: a composable
// behind a condition breaks call order, and the query is public and small.
const { data: processes } = useUmpProcesses()

const steps = ['choose', 'configure', 'take'] as const

// On narrow screens the design shows a menu instead of the header actions. It
// contains exactly the same entries, so there is no second set that can drift.
const menu = computed(() => [
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
  <!-- Blocked: narrow card on the gradient, one main action. -->
  <NuxtLayout v-if="blocked" name="auth">
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

      <!-- Only a text link, not a second equal button: someone who was blocked
           wanted to go somewhere other than the catalog. -->
      <ULink to="/commons" class="block text-sm font-medium text-(--ui-primary)">
        {{ t('start.blocked.orBrowse') }}
      </ULink>
    </div>
  </NuxtLayout>

  <!-- Showcase -->
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

        <UDropdownMenu :items="menu" class="sm:hidden">
          <UButton
            icon="i-lucide-menu"
            color="neutral"
            variant="ghost"
            :aria-label="t('app.title')"
          />
        </UDropdownMenu>
      </div>
    </header>

    <!-- Hero. Text on the left; on the right a real model run drawn from its
         result GeoJSON, hence the credit below and no stock illustration. -->
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
              to="/commons"
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
          <!-- The file is square (600 x 600) and draws the network with a margin.
               The design shows it portrait, 349 x 464, so on wide screens it is
               scaled by height rather than width: the network then fills the box
               as in the design without distorting the file. -->
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
          <li v-for="p in processes" :key="p.id">
            <ModelCard
              :title="p.title"
              :description="p.description"
              tone="gold"
              :to="{ path: '/run', query: { process: p.id } }"
            />
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
            v-for="(step, i) in steps"
            :key="step"
            class="space-y-2.5 py-6 md:pr-6"
          >
            <span class="inline-block bg-ufc-teal-700 pl-1 pr-4 text-lg/7 font-semibold text-white">
              {{ i + 1 }}
            </span>
            <h3 class="font-medium text-(--ui-text)">
              {{ t(`start.steps.${step}.title`) }}
            </h3>
            <p class="text-sm text-(--ui-text-muted)">
              {{ t(`start.steps.${step}.body`) }}
            </p>
          </li>
        </ol>
      </div>
    </section>

    <!-- The two routes side by side. Alone each looks like a hurdle; together
         they say what the project offers: we do not sell AI, you bring your
         own.
         No input field here: only signed-in users can chat, and a field that
         first leads to sign-in promises more than it delivers. The MCP server
         address is on the help page, where it is explained. -->
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
