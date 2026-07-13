<script setup lang="ts">
import type { FeatureCollection } from 'geojson'

const { t, locale, locales, setLocale } = useI18n()
const colorMode = useColorMode()
const { loggedIn, user, login, logout } = useOidcAuth()
const { data: processes, pending, error, refresh } = useUmpProcesses()

const availableLocales = computed(() => locales.value)
const userName = computed(
  () => user.value?.userName ?? user.value?.claims?.preferred_username ?? '',
)

const selectedProcessId = ref<string | null>(null)
const mapData = ref<FeatureCollection | null>(null)

function selectProcess(id: string) {
  selectedProcessId.value = id
  mapData.value = null
}

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
      <UContainer class="py-8">
        <div class="grid gap-6 lg:grid-cols-[20rem_1fr]">
          <!-- Prozessliste -->
          <section class="space-y-3">
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

            <ul v-if="processes?.length" class="space-y-1">
              <li v-for="p in processes" :key="p.id">
                <button
                  type="button"
                  class="w-full rounded-md border px-3 py-2 text-left transition-colors"
                  :class="p.id === selectedProcessId
                    ? 'border-(--ui-primary) bg-(--ui-primary)/5'
                    : 'border-(--ui-border) hover:bg-(--ui-bg-elevated)'"
                  @click="selectProcess(p.id)"
                >
                  <div class="font-medium">{{ p.title }}</div>
                  <div class="text-xs text-(--ui-text-muted)">{{ p.id }}</div>
                </button>
              </li>
            </ul>
            <p v-else-if="!pending" class="text-sm text-(--ui-text-muted)">
              {{ t('processes.empty') }}
            </p>
          </section>

          <!-- Runner + Karte -->
          <section class="space-y-4">
            <ProcessRunner
              v-if="selectedProcessId"
              :key="selectedProcessId"
              :process-id="selectedProcessId"
              @result="mapData = $event"
            />
            <p v-else class="text-sm text-(--ui-text-muted)">
              {{ t('run.selectHint') }}
            </p>

            <UmpMap :data="mapData" />
          </section>
        </div>
      </UContainer>
    </UMain>
  </UApp>
</template>
