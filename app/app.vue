<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

const { t, locale, locales, setLocale } = useI18n()
const colorMode = useColorMode()
const { loggedIn, user, login, logout } = useOidcAuth()
const { isAdmin } = useUmpRoles()

const availableLocales = computed(() => locales.value)
const userName = computed(
  () => user.value?.userName ?? user.value?.claims?.preferred_username ?? '',
)

// Rollenabhängige Navigation: Modelle/Neues Szenario/Meine Szenarien immer,
// Administration nur mit ump_admin (bzw. Dev-Override). UNavigationMenu markiert
// den aktiven Eintrag anhand von `to` automatisch.
const navItems = computed<NavigationMenuItem[]>(() => {
  const items: NavigationMenuItem[] = [
    { label: t('nav.models'), icon: 'i-lucide-boxes', to: '/models' },
    { label: t('nav.run'), icon: 'i-lucide-play', to: '/run' },
    { label: t('nav.jobs'), icon: 'i-lucide-history', to: '/jobs' },
  ]
  if (isAdmin.value) {
    items.push({ label: t('nav.admin'), icon: 'i-lucide-shield', to: '/admin' })
  }
  return items
})

function toggleColorMode() {
  colorMode.preference = colorMode.value === 'dark' ? 'light' : 'dark'
}
</script>

<template>
  <UApp>
    <UHeader :title="t('app.title')" to="/">
      <UNavigationMenu :items="navItems" />

      <template #right>
        <!-- Auth: Login/Logout + User -->
        <ClientOnly>
          <div class="flex items-center gap-2">
            <template v-if="loggedIn">
              <span class="hidden text-sm text-(--ui-text-muted) sm:inline">
                {{ t('auth.loggedInAs', { name: userName }) }}
              </span>
              <UButton
                icon="i-lucide-log-out"
                color="neutral"
                variant="soft"
                size="xs"
                @click="logout()"
              >
                {{ t('auth.logout') }}
              </UButton>
            </template>
            <UButton
              v-else
              icon="i-lucide-log-in"
              color="primary"
              variant="solid"
              size="xs"
              @click="login()"
            >
              {{ t('auth.login') }}
            </UButton>
          </div>
          <template #fallback>
            <div class="h-6 w-16" />
          </template>
        </ClientOnly>

        <!-- Sprachumschalter DE/EN (Cookie-basiert, no_prefix) -->
        <div class="flex items-center gap-1">
          <UButton
            v-for="loc in availableLocales"
            :key="loc.code"
            :variant="loc.code === locale ? 'solid' : 'ghost'"
            color="neutral"
            size="xs"
            @click="setLocale(loc.code)"
          >
            {{ loc.code.toUpperCase() }}
          </UButton>
        </div>

        <!-- Color-Mode-Toggle -->
        <ClientOnly>
          <UButton
            :icon="colorMode.value === 'dark' ? 'i-lucide-moon' : 'i-lucide-sun'"
            :aria-label="t('colorMode.toggle')"
            color="neutral"
            variant="ghost"
            @click="toggleColorMode"
          />
          <template #fallback>
            <div class="size-8" />
          </template>
        </ClientOnly>
      </template>
    </UHeader>

    <UMain>
      <UContainer class="py-8">
        <NuxtPage />
      </UContainer>
    </UMain>
  </UApp>
</template>
