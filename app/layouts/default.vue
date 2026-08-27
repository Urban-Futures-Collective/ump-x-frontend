<script setup lang="ts">
import type { BreadcrumbItem, NavigationMenuItem } from '@nuxt/ui'

// Arbeitsumgebung nach den Wireframes: Seitenleiste links (einklappbar),
// Kopfleiste mit Brotkrumen, Inhalt in einer hellen Karte.
const { t, locale, locales, setLocale } = useI18n()
const route = useRoute()
const { loggedIn, user, login, logout } = useOidcAuth()
const { isAdmin } = useUmpRoles()

const userName = computed(
  () => user.value?.userName ?? user.value?.claims?.preferred_username ?? '',
)

// Was es wirklich gibt. Die Reihenfolge folgt den Wireframes: erst der Katalog
// („Commons"), dann das Erstellen, dann die eigenen Läufe.
const navItems = computed<NavigationMenuItem[]>(() => {
  const items: NavigationMenuItem[] = [
    { label: t('nav.models'), icon: 'i-lucide-grid-3x3', to: '/models' },
    { label: t('nav.run'), icon: 'i-lucide-pencil-line', to: '/run' },
    { label: t('nav.jobs'), icon: 'i-lucide-history', to: '/jobs' },
  ]
  if (isAdmin.value) {
    items.push({ label: t('nav.admin'), icon: 'i-lucide-shield', to: '/admin' })
  }
  return items
})

// Was die Wireframes zeigen, wozu aber die Grundlage fehlt: Projekte brauchen
// eine eigene Datenhaltung, die es im Backend nicht gibt. Rico hat im Team-Chat
// vorgeschlagen, solche Teile zu zeigen und auszugrauen statt sie wegzulassen.
// Deaktiviert, damit niemand ins Leere klickt, aber sichtbar, damit erkennbar
// ist, wohin es geht.
const plannedItems = computed<NavigationMenuItem[]>(() => [
  { label: t('nav.planned.projects'), icon: 'i-lucide-folder', disabled: true },
  { label: t('nav.planned.contribute'), icon: 'i-lucide-file-plus-2', disabled: true },
  { label: t('nav.planned.data'), icon: 'i-lucide-git-fork', disabled: true },
  { label: t('nav.planned.report'), icon: 'i-lucide-file-text', disabled: true },
])

// Brotkrume: Home plus die aktuelle Stelle. Bewusst flach, solange es keine
// Projektebene gibt, in die man hineinnavigieren könnte.
const breadcrumb = computed<BreadcrumbItem[]>(() => {
  const here = [...navItems.value, ...plannedItems.value].find(
    i => i.to && route.path.startsWith(String(i.to)),
  )
  const items: BreadcrumbItem[] = [{ label: t('nav.home'), icon: 'i-lucide-house', to: '/' }]
  if (here) {
    items.push({ label: String(here.label) })
  }
  return items
})
</script>

<template>
  <UDashboardGroup storage-key="ump-x-sidebar">
    <UDashboardSidebar
      collapsible
      resizable
      :default-size="17"
      :min-size="13"
      :max-size="24"
    >
      <template #header="{ collapsed }">
        <NuxtLink to="/" class="flex min-w-0 items-center gap-2">
          <!-- Eingeklappt bleibt nur das Zeichen stehen, deshalb trägt es den
               Alternativtext und die Wortmarke daneben ist rein dekorativ. -->
          <img
            src="~/assets/images/logo.svg"
            :alt="t('app.title')"
            class="size-7 shrink-0"
            width="28"
            height="28"
          >
          <span v-if="!collapsed" class="truncate font-semibold">
            {{ t('app.title') }}
          </span>
        </NuxtLink>
      </template>

      <template #default="{ collapsed }">
        <UNavigationMenu
          orientation="vertical"
          :collapsed="collapsed"
          :items="navItems"
          class="w-full"
        />

        <USeparator class="my-3" />

        <p v-if="!collapsed" class="px-2.5 pb-1 text-xs font-medium text-(--ui-text-dimmed)">
          {{ t('nav.planned.heading') }}
        </p>
        <UNavigationMenu
          orientation="vertical"
          :collapsed="collapsed"
          :items="plannedItems"
          class="w-full"
        />
      </template>

      <template #footer="{ collapsed }">
        <ClientOnly>
          <div class="w-full space-y-2">
            <template v-if="loggedIn">
              <p v-if="!collapsed" class="truncate px-1 text-xs text-(--ui-text-muted)">
                {{ t('auth.loggedInAs', { name: userName }) }}
              </p>
              <UButton
                icon="i-lucide-log-out"
                color="neutral"
                variant="ghost"
                size="sm"
                :square="collapsed"
                :block="!collapsed"
                @click="logout()"
              >
                <span v-if="!collapsed">{{ t('auth.logout') }}</span>
              </UButton>
            </template>
            <UButton
              v-else
              icon="i-lucide-log-in"
              color="primary"
              size="sm"
              :square="collapsed"
              :block="!collapsed"
              @click="login()"
            >
              <span v-if="!collapsed">{{ t('auth.login') }}</span>
            </UButton>
          </div>
          <template #fallback>
            <div class="h-8" />
          </template>
        </ClientOnly>
      </template>
    </UDashboardSidebar>

    <UDashboardPanel>
      <template #header>
        <UDashboardNavbar>
          <template #leading>
            <UDashboardSidebarCollapse />
          </template>

          <template #title>
            <UBreadcrumb :items="breadcrumb" />
          </template>

          <template #right>
            <!-- Geplant, noch ohne Funktion. Sichtbar aus demselben Grund wie
                 die ausgegrauten Einträge in der Seitenleiste. -->
            <UButton
              icon="i-lucide-sparkles"
              color="neutral"
              variant="ghost"
              size="sm"
              disabled
              class="hidden md:inline-flex"
            >
              {{ t('nav.planned.ask') }}
            </UButton>
            <UButton
              icon="i-lucide-book-open"
              color="neutral"
              variant="ghost"
              size="sm"
              disabled
              class="hidden md:inline-flex"
            >
              {{ t('nav.planned.readme') }}
            </UButton>

            <div class="flex items-center gap-1">
              <UButton
                v-for="loc in locales"
                :key="loc.code"
                :variant="loc.code === locale ? 'solid' : 'ghost'"
                color="neutral"
                size="xs"
                @click="setLocale(loc.code)"
              >
                {{ loc.code.toUpperCase() }}
              </UButton>
            </div>
          </template>
        </UDashboardNavbar>
      </template>

      <!-- Inhalt in einer eigenen, leicht getönten Fläche, wie im Entwurf.
           Ohne das steht weißer Inhalt auf weißem Grund und die Kopfleiste
           schwebt ohne erkennbare Kante darüber. -->
      <template #body>
        <div class="min-h-full rounded-xl bg-ufc-blue-50/40 p-6 sm:p-8">
          <slot />
        </div>
      </template>
    </UDashboardPanel>
  </UDashboardGroup>
</template>
