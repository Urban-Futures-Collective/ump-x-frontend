<script setup lang="ts">
import type { BreadcrumbItem, NavigationMenuItem } from '@nuxt/ui'

// Workspace layout: collapsible sidebar on the left, header with breadcrumbs,
// content in a light card.
const { t, locale, locales, setLocale } = useI18n()
const route = useRoute()
const { loggedIn, user, login, logout } = useOidcAuth()
const { isAdmin, isProvider, isVerifier } = useUmpRoles()
const { accountUrl, prototypes } = useRuntimeConfig().public
const { awaitingReview } = useRegistryPrototype()

// The chat lives in a slide-over so it does not push the workspace aside.
const chatOpen = ref(false)

const userName = computed(
  () => String(user.value?.userName ?? user.value?.claims?.preferred_username ?? ''),
)

// Navigation per the "Landing Screen" design: the model catalog (Commons) and
// the user's own runs. New scenarios are started from a model in Commons; help
// is linked from the header.
const navItems = computed<NavigationMenuItem[]>(() => {
  const items: NavigationMenuItem[] = [
    { label: t('nav.models'), icon: 'i-lucide-grid-3x3', to: '/commons' },
    { label: t('nav.jobs'), icon: 'i-lucide-history', to: '/jobs' },
  ]
  // Model registry as a prototype with sample data, only where switched on
  // (NUXT_PUBLIC_PROTOTYPES) and for the matching role.
  if (prototypes && isProvider.value) {
    items.push({ label: t('nav.contribute'), icon: 'i-lucide-file-plus-2', to: '/contribute', badge: { label: t('prototype.badge'), color: 'warning', variant: 'subtle', size: 'sm' } })
  }
  if (prototypes && isVerifier.value) {
    const n = awaitingReview.value.length
    items.push({
      label: t('nav.verify'),
      icon: 'i-lucide-list-checks',
      to: '/verify',
      badge: n ? { label: t('nav.verifyNew', { n }), color: 'info', variant: 'subtle', size: 'sm' } : { label: t('prototype.badge'), color: 'warning', variant: 'subtle', size: 'sm' },
    })
  }
  if (isAdmin.value) {
    items.push({ label: t('nav.admin'), icon: 'i-lucide-shield', to: '/admin' })
  }
  return items
})

// Features from the design that have no backend yet (projects need their own
// storage). Shown disabled rather than hidden: nobody clicks into nothing, but
// users can see where the product is heading.
const plannedItems = computed<NavigationMenuItem[]>(() => [
  { label: t('nav.planned.projects'), icon: 'i-lucide-folder', disabled: true },
  ...(prototypes ? [] : [{ label: t('nav.planned.contribute'), icon: 'i-lucide-file-plus-2', disabled: true }]),
  { label: t('nav.planned.data'), icon: 'i-lucide-git-fork', disabled: true },
  { label: t('nav.planned.report'), icon: 'i-lucide-file-text', disabled: true },
])

// Two-letter initials: from given and family name if available, otherwise the
// first two letters of the username (often not distinctive). No name, no
// initials rather than made-up ones.
const initials = computed(() => {
  const info = user.value?.userInfo as { given_name?: string, family_name?: string } | undefined
  const firstName = info?.given_name?.trim() ?? ''
  const lastName = info?.family_name?.trim() ?? ''
  if (firstName && lastName) return (firstName[0]! + lastName[0]!).toUpperCase()
  return userName.value.slice(0, 2).toUpperCase()
})

// "Request access" is visible but disabled, following the same rule as the
// planned sidebar items. Where such a request would go is not decided yet.
const userMenu = computed(() => [[
  {
    label: userName.value,
    description: t('auth.viaKeycloak'),
    type: 'label' as const,
  },
], [
  {
    label: t('auth.profile'),
    icon: 'i-lucide-user',
    to: accountUrl,
    target: '_blank',
  },
  {
    label: t('auth.requestAccess'),
    icon: 'i-lucide-shield',
    disabled: true,
  },
], [
  {
    label: t('auth.logout'),
    icon: 'i-lucide-log-out',
    // Signing out leaves nothing behind: the provider API key is stored
    // unencrypted in the browser and the chat history contains questions and
    // runs, which the next person on a shared machine would otherwise see.
    // Silent, without confirmation: signing out means exactly that.
    onSelect: () => {
      forgetAccess()
      forgetHistory()
      logout()
    },
  },
]])

// Breadcrumb: Home plus the current location. Flat as long as there is no
// project level to navigate into. Pages without their own sidebar entry hang
// off their path: a new scenario starts from Commons.
const breadcrumb = computed<BreadcrumbItem[]>(() => {
  const items: BreadcrumbItem[] = [{ label: t('nav.home'), icon: 'i-lucide-house', to: '/' }]
  if (route.path.startsWith('/run')) {
    items.push({ label: t('nav.models'), to: '/commons' }, { label: t('nav.run') })
    return items
  }
  if (route.path.startsWith('/hilfe')) {
    items.push({ label: t('nav.help') })
    return items
  }
  const here = [...navItems.value, ...plannedItems.value].find(
    i => i.to && route.path.startsWith(String(i.to)),
  )
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
          <!-- When collapsed only the logo remains, so it carries the alt text
               and the wordmark next to it is decorative. -->
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
            <!-- The chat does not bring its own model; the user supplies one.
                 Hence the button is called "Chat" rather than after a provider,
                 and it opens a setup form first. -->
            <UButton
              icon="i-lucide-sparkles"
              color="neutral"
              variant="ghost"
              size="sm"
              :aria-label="t('nav.chat')"
              @click="() => { chatOpen = true }"
            >
              <span class="hidden md:inline">{{ t('nav.chat') }}</span>
            </UButton>

            <UButton
              icon="i-lucide-book-open"
              color="neutral"
              variant="ghost"
              size="sm"
              to="/hilfe"
              :aria-label="t('nav.help')"
            >
              <span class="hidden md:inline">{{ t('nav.help') }}</span>
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

            <!-- Account menu top right, in the same place whether signed in or
                 not. Sign-out lives only here: two routes to the same action
                 add nothing. -->
            <ClientOnly>
              <UDropdownMenu v-if="loggedIn" :items="userMenu" :ui="{ content: 'w-64' }">
                <UButton color="neutral" variant="ghost" size="sm" trailing-icon="i-lucide-chevron-down">
                  <UAvatar :text="initials" size="xs" />
                </UButton>
              </UDropdownMenu>
              <UButton
                v-else
                icon="i-lucide-log-in"
                color="primary"
                size="sm"
                @click="login()"
              >
                {{ t('auth.login') }}
              </UButton>
              <template #fallback>
                <div class="h-8 w-20" />
              </template>
            </ClientOnly>
          </template>
        </UDashboardNavbar>
      </template>

      <!-- Content on its own lightly tinted surface, as in the design. Without
           it white content sits on white and the header floats without an edge.
           The panel body is a scrolling flex column: shrink-0 keeps the surface
           from shrinking to the viewport height on long pages, min-h-full makes
           it reach the bottom on short ones. -->
      <template #body>
        <div class="min-h-full shrink-0 rounded-xl bg-ufc-blue-50/40 p-6 sm:p-8">
          <slot />
        </div>
      </template>
    </UDashboardPanel>

    <!-- ClientOnly: the chat pulls in the AI SDK and runs only in the browser
         (the user's API key must never reach our server). Lazy so the SDK is
         not in every page's initial bundle. -->
    <ClientOnly>
      <USlideover v-model:open="chatOpen" :ui="{ content: 'w-full max-w-md' }">
        <template #content>
          <LazyAiChatPanel @close="chatOpen = false" />
        </template>
      </USlideover>
    </ClientOnly>
  </UDashboardGroup>
</template>
