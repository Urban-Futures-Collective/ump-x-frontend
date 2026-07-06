<script setup lang="ts">
const { t, locale, locales, setLocale } = useI18n()
const colorMode = useColorMode()
const { loggedIn, user, login, logout } = useOidcAuth()
const { data: processes, pending, error, refresh } = useUmpProcesses()

const availableLocales = computed(() => locales.value)
const userName = computed(
  () => user.value?.userName ?? user.value?.claims?.preferred_username ?? '',
)

function toggleColorMode() {
  colorMode.preference = colorMode.value === 'dark' ? 'light' : 'dark'
}
</script>

<template>
  <UApp>
    <UHeader :title="t('app.title')">
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
      <UContainer class="space-y-4 py-8">
        <div class="flex items-center justify-between">
          <h2 class="text-lg font-semibold">
            {{ t('processes.title') }}
          </h2>
          <UButton
            icon="i-lucide-refresh-cw"
            color="neutral"
            variant="ghost"
            size="xs"
            :loading="pending"
            @click="refresh()"
          >
            {{ t('processes.refresh') }}
          </UButton>
        </div>

        <p v-if="!loggedIn" class="text-sm text-(--ui-text-muted)">
          {{ t('processes.anonymousHint') }}
        </p>
        <p v-if="error" class="text-sm text-red-600 dark:text-red-400">
          {{ t('processes.error') }}
        </p>

        <ul v-if="processes?.length" class="divide-y divide-(--ui-border)">
          <li v-for="p in processes" :key="p.id" class="py-2">
            <div class="font-medium">
              {{ p.title }}
              <span class="font-normal text-(--ui-text-muted)">({{ p.id }})</span>
            </div>
            <div v-if="p.description" class="text-sm text-(--ui-text-muted)">
              {{ p.description }}
            </div>
          </li>
        </ul>
        <p v-else-if="!pending" class="text-sm text-(--ui-text-muted)">
          {{ t('processes.empty') }}
        </p>
      </UContainer>
    </UMain>
  </UApp>
</template>
