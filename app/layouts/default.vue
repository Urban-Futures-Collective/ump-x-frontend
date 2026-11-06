<script setup lang="ts">
import bmftrDe from '~/assets/images/funding/bmftr-de.svg?url'
import bmftrEn from '~/assets/images/funding/bmftr-en.svg?url'
import ptfDe from '~/assets/images/funding/ptf-de.svg?url'
import ptfEn from '~/assets/images/funding/ptf-en.svg?url'
import type { BreadcrumbItem, NavigationMenuItem } from '@nuxt/ui'

// Workspace layout: collapsible sidebar on the left, header with breadcrumbs,
// content in a light card.
const { t, locale, locales, setLocale } = useI18n()

// Funding logos in the language of the page (BMFTR "Gefördert durch", Prototype Fund
// "Unterstützt durch"); both must be shown as delivered, so not muted like the rest.
const fundingLogos = computed(() => locale.value === 'de'
  ? { bmftr: bmftrDe, ptf: ptfDe }
  : { bmftr: bmftrEn, ptf: ptfEn })
const route = useRoute()
const { loggedIn, user, login, logout } = useOidcAuth()
const { isAdmin, isAccessAdmin, isProvider, isVerifier } = useUmpRoles()
const { accountUrl, prototypes: samples, registryApi } = useRuntimeConfig().public
// The registry pages exist with sample data or with the registry API.
const prototypes = samples || registryApi
const { awaitingReview } = useRegistry()
// Sample data is marked as such; the live registry is not.
const sampleBadge = registryApi ? undefined : { label: t('prototype.badge'), color: 'warning' as const, variant: 'subtle' as const, size: 'sm' as const }

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
    { label: t('nav.models'), icon: 'i-material-symbols-apps', to: '/commons' },
  ]
  // Model registry as a prototype with sample data, only where switched on
  // (NUXT_PUBLIC_PROTOTYPES) and for the matching role.
  if (prototypes && isProvider.value) {
    items.push({ label: t('nav.contribute'), icon: 'i-material-symbols-file-export-outline', to: '/contribute', badge: sampleBadge })
  }
  items.push({ label: t('nav.jobs'), icon: 'i-material-symbols-history', to: '/jobs' })
  return items
})

// Second block, as in the design: administration and Verify. Verify only for
// verifiers: a greyed-out entry for everyone else read as a broken page in testing.
const manageItems = computed<NavigationMenuItem[]>(() => {
  const items: NavigationMenuItem[] = []
  if (isAdmin.value) {
    items.push({ label: t('nav.admin'), icon: 'i-material-symbols-admin-panel-settings-outline', to: '/admin' })
  }
  // Model access (design A4) belongs to access admins, not to platform admins.
  if (isAccessAdmin.value) {
    items.push({ label: t('nav.access'), icon: 'i-material-symbols-approval-delegation-outline', to: '/access' })
  }
  if (!prototypes || !isVerifier.value) return items
  const n = awaitingReview.value.length
  items.push({
    label: t('nav.verify'),
    icon: 'i-material-symbols-playlist-add-check',
    to: '/verify',
    badge: n ? { label: t('nav.verifyNew', { n }), color: 'success', variant: 'subtle', size: 'sm' } : sampleBadge,
  })
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

// Breadcrumb: Home plus the current location: the sidebar section and, on a page
// below it, that page (named by the page itself, see usePageCrumb). Pages without
// their own sidebar entry hang off their path: a new scenario starts from Commons.
// Shown only with at least two entries: a single one just repeats the headline
// (#111, item 22).
//
// Every entry is a link, the current page included. Home only for visitors: the
// start page sends signed-in users straight on to Commons, so for them "Start"
// was a link that went nowhere.
const pageCrumb = usePageCrumbLabel()
const breadcrumb = computed<BreadcrumbItem[]>(() => {
  const items: BreadcrumbItem[] = loggedIn.value ? [] : [{ label: t('nav.home'), icon: 'i-lucide-house', to: '/' }]
  const here = route.fullPath
  if (route.path.startsWith('/run')) {
    items.push({ label: t('nav.models'), to: '/commons' }, { label: t('nav.run'), to: here })
    return items
  }
  // A model page names its model (set by the page, see commons/[id].vue).
  if (route.path.startsWith('/commons/')) {
    items.push({ label: t('commons.title'), to: '/commons' }, { label: pageCrumb.value || String(route.params.id ?? ''), to: here })
    return items
  }
  if (route.path.startsWith('/help')) {
    items.push({ label: t('nav.help'), to: here })
    return items
  }
  const entry = [...navItems.value, ...manageItems.value].find(
    i => i.to && route.path.startsWith(String(i.to)),
  )
  if (entry) {
    items.push({ label: String(entry.label), to: String(entry.to) })
    const below = route.path.replace(/\/$/, '') !== String(entry.to)
    const label = pageCrumb.value || String(route.params.id ?? '')
    if (below && label) items.push({ label, to: here })
  }
  return items
})

// Tab title from the last breadcrumb entry; pages with a more specific title set their own.
useHead({ title: () => String(breadcrumb.value.at(-1)?.label ?? '') })
</script>

<template>
  <!-- Sidebar width in rem, as in the design (16rem = 256px), instead of a share of the
       window that grows on large screens. New storage key: sizes saved under the old
       one were percentages. -->
  <UDashboardGroup storage-key="ump-x-sidebar-rem" unit="rem">
    <UDashboardSidebar
      collapsible
      resizable
      :default-size="16"
      :collapsed-size="4.25"
      :min-size="13"
      :max-size="22"
    >
      <template #header="{ collapsed }">
        <!-- Collapsed, the header is narrower than logo and chevron plus padding, so the
             group reaches into the right padding (keeping some distance to the edge). -->
        <div class="flex w-full min-w-0 items-center gap-1" :class="collapsed ? '-me-3' : ''">
          <NuxtLink to="/" class="flex items-center gap-2" :class="collapsed ? 'shrink-0' : 'min-w-0 flex-1'">
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
          <!-- Collapse toggle next to the logo (design proposal): a small chevron that
               points the way the sidebar will move. Hidden on mobile by Nuxt UI, where
               the sidebar opens as a slideover. -->
          <UDashboardSidebarCollapse
            :icon="collapsed ? 'i-lucide-chevron-right' : 'i-lucide-chevron-left'"
            color="neutral"
            variant="ghost"
            size="xs"
            class="shrink-0 px-0"
          />
        </div>
      </template>

      <template #default="{ collapsed }">
        <UNavigationMenu
          orientation="vertical"
          color="neutral"
          :collapsed="collapsed"
          :items="navItems"
          :class="collapsed ? 'w-8' : 'w-full'"
        />

        <template v-if="manageItems.length">
          <USeparator class="my-3" />
          <UNavigationMenu
            orientation="vertical"
            color="neutral"
            :collapsed="collapsed"
            :items="manageItems"
            :class="collapsed ? 'w-8' : 'w-full'"
          />
        </template>

        <USeparator class="my-3" />

        <p v-if="!collapsed" class="px-2.5 pb-1 text-xs font-medium text-(--ui-text-dimmed)">
          {{ t('nav.planned.heading') }}
        </p>
        <UNavigationMenu
          orientation="vertical"
          :collapsed="collapsed"
          :items="plannedItems"
          :class="collapsed ? 'w-8' : 'w-full'"
        />
      </template>

      <!-- Operator, partner and funders at the bottom, two per row so they stay small.
           Too small to read when collapsed, so left out then. -->
      <template #footer="{ collapsed }">
        <div v-if="!collapsed" class="grid w-full grid-cols-2 items-center gap-x-4 gap-y-3 px-2.5 pb-1">
          <img src="~/assets/images/ufc.svg" alt="Urban Futures Collective" class="max-h-9 w-full object-contain object-left">
          <img src="~/assets/images/city-science-lab.png" alt="City Science Lab" class="max-h-7 w-full object-contain object-left opacity-60">
          <img :src="fundingLogos.bmftr" :alt="t('partners.bmftr')" class="w-full">
          <img :src="fundingLogos.ptf" :alt="t('partners.ptf')" class="w-full">
        </div>
      </template>
    </UDashboardSidebar>

    <!-- No padding around the body: the tinted surface below runs to the edges, as in
         the design, instead of sitting as a card in a white frame. -->
    <UDashboardPanel :ui="{ body: 'p-0 sm:p-0' }">
      <template #header>
        <UDashboardNavbar>
          <!-- A typed "/" in the breadcrumb's own font: the slash icon was taller and
               thinner than the text around it. -->
          <template #title>
            <UBreadcrumb v-if="breadcrumb.length > 1" :items="breadcrumb">
              <template #separator>
                <span class="px-0.5 text-(--ui-text-dimmed)">/</span>
              </template>
            </UBreadcrumb>
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
              to="/help"
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
      <!-- Legal links on every workspace page, as in the design; the imprint has to be
           reachable from everywhere. -->
      <template #footer>
        <TheFooter compact />
      </template>

      <template #body>
        <div class="min-h-full shrink-0 bg-ufc-blue-50/40 p-6 sm:p-8">
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
