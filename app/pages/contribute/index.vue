<script setup lang="ts">
import type { DropdownMenuItem, TabsItem } from '@nuxt/ui'
import type { RegistryModel, RegistryStatus } from '~/types/registry'
import { REGISTRY_STATUSES } from '~/types/registry'
import { CONTRIBUTE_GROUPS, contributeGroup } from '~/utils/registryWorkflow'
import type { ContributeGroup } from '~/utils/registryWorkflow'

// Contribute (design P1): the signed-in provider's models, grouped by who has to act
// next, and their model servers. Prototype with sample data (see useRegistryPrototype).
definePageMeta({ middleware: ['auth', 'prototype', 'provider'] })
const { t, locale } = useI18n()
const { myModels, myServers } = useRegistryPrototype()

const tab = ref<'models' | 'servers'>('models')
const tabs = computed<TabsItem[]>(() => [
  { label: t('registry.contribute.tabModels', { n: myModels.value.length }), value: 'models' },
  { label: t('registry.contribute.tabServers', { n: myServers.value.length }), value: 'servers' },
])

const search = ref('')
const sortBy = ref<'changed' | 'name'>('changed')
const statusFilter = ref<RegistryStatus | 'all'>('all')
const tiles = ref(false)

const titleOf = (m: RegistryModel) => inLang(m.fullName, locale.value, m.defaultLang) || m.remoteProcessId

const sortItems = computed<DropdownMenuItem[]>(() => (['changed', 'name'] as const).map(value => ({
  label: t(value === 'changed' ? 'registry.contribute.sortChanged' : 'registry.contribute.sortName'),
  type: 'checkbox' as const,
  checked: sortBy.value === value,
  onUpdateChecked: () => { sortBy.value = value },
})))

// Only statuses the owner actually has, so the filter never offers an empty result.
const filterItems = computed<DropdownMenuItem[]>(() => {
  const present = REGISTRY_STATUSES.filter(s => myModels.value.some(m => m.status === s))
  return (['all', ...present] as const).map(value => ({
    label: value === 'all' ? t('registry.contribute.filterAll') : t(`registry.status.${value}`),
    type: 'checkbox' as const,
    checked: statusFilter.value === value,
    onUpdateChecked: () => { statusFilter.value = value },
  }))
})

const shown = computed(() => myModels.value
  .filter(m => statusFilter.value === 'all' || m.status === statusFilter.value)
  .filter(m => matchesSearch(search.value, titleOf(m), inLang(m.shortDescription, locale.value, m.defaultLang), m.serverName, m.remoteProcessId))
  .sort((a, b) => sortBy.value === 'name'
    ? titleOf(a).localeCompare(titleOf(b), locale.value)
    : b.statusChangedAt.localeCompare(a.statusChangedAt)))

const groups = computed(() => CONTRIBUTE_GROUPS
  .map(key => ({ key, models: shown.value.filter(m => contributeGroup(m.status) === key) }))
  .filter(g => g.models.length))

// Models that are no longer going anywhere start folded away.
const open = reactive<Record<ContributeGroup, boolean>>({ action: true, awaiting: true, live: true, closed: false })

const servers = computed(() => myServers.value.filter(s => matchesSearch(search.value, s.name, s.baseUrl)))
const modelsOn = (name: string) => myModels.value.filter(m => m.serverName === name).length
</script>

<template>
  <section class="max-w-6xl space-y-6">
    <PrototypeNotice />

    <div class="flex flex-wrap items-start justify-between gap-4">
      <div class="max-w-xl space-y-1">
        <h1 class="text-2xl font-semibold text-ufc-slate-900">
          {{ t('registry.contribute.title') }}
        </h1>
        <p class="text-sm text-(--ui-text-muted)">
          {{ t('registry.contribute.intro') }}
        </p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <UInput
          v-model="search"
          icon="i-lucide-search"
          :placeholder="t(tab === 'models' ? 'registry.contribute.searchModels' : 'registry.contribute.searchServers')"
          :aria-label="t(tab === 'models' ? 'registry.contribute.searchModels' : 'registry.contribute.searchServers')"
        />
        <UButton icon="i-lucide-plus" to="/contribute/new">
          {{ t('registry.contribute.new') }}
        </UButton>
      </div>
    </div>

    <div class="flex flex-wrap items-end justify-between gap-2 border-b border-(--ui-border)">
      <UTabs v-model="tab" :items="tabs" :content="false" variant="link" class="-mb-px" />
      <div v-if="tab === 'models'" class="flex items-center gap-1 pb-1">
        <UDropdownMenu :items="sortItems" :content="{ align: 'end' }">
          <UButton icon="i-lucide-arrow-down-up" color="neutral" variant="ghost" :aria-label="t('registry.contribute.sort')" />
        </UDropdownMenu>
        <UDropdownMenu :items="filterItems" :content="{ align: 'end' }">
          <UButton
            icon="i-lucide-list-filter"
            :color="statusFilter === 'all' ? 'neutral' : 'primary'"
            variant="ghost"
            :aria-label="t('registry.contribute.filter')"
          />
        </UDropdownMenu>
        <UButton
          icon="i-lucide-layout-grid"
          :color="tiles ? 'primary' : 'neutral'"
          variant="ghost"
          :aria-label="t('registry.contribute.viewTiles')"
          :aria-pressed="tiles"
          @click="() => { tiles = true }"
        />
        <UButton
          icon="i-lucide-list"
          :color="tiles ? 'neutral' : 'primary'"
          variant="ghost"
          :aria-label="t('registry.contribute.viewList')"
          :aria-pressed="!tiles"
          @click="() => { tiles = false }"
        />
      </div>
    </div>

    <template v-if="tab === 'models'">
      <p v-if="!groups.length" class="text-sm text-(--ui-text-muted)">
        {{ search || statusFilter !== 'all' ? t('registry.noMatch') : t('registry.contribute.empty') }}
      </p>
      <UCollapsible v-for="g in groups" :key="g.key" v-model:open="open[g.key]" class="space-y-3">
        <UButton
          variant="link"
          class="px-0 text-base font-semibold"
          :trailing-icon="open[g.key] ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
        >
          {{ t(`registry.contribute.groups.${g.key}`) }}
          <span class="font-normal text-(--ui-text-muted)">· {{ g.models.length }}</span>
        </UButton>
        <template #content>
          <ul :class="tiles ? 'grid gap-4 sm:grid-cols-2 xl:grid-cols-3' : 'space-y-3'">
            <li v-for="m in g.models" :key="m.id">
              <RegistryModelCard :model="m" :to="`/contribute/${m.id}`" :tile="tiles" />
            </li>
          </ul>
        </template>
      </UCollapsible>
    </template>

    <template v-else>
      <h2 class="text-base font-semibold text-(--ui-primary)">
        {{ t('registry.contribute.servers') }}
      </h2>
      <p v-if="!servers.length" class="text-sm text-(--ui-text-muted)">
        {{ search ? t('registry.noMatch') : t('registry.contribute.serversEmpty') }}
      </p>
      <ul v-else class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <li v-for="s in servers" :key="s.id" class="space-y-1 rounded-lg border border-(--ui-border) bg-white p-4">
          <p class="font-semibold text-(--ui-text-highlighted)">
            {{ s.name }}
          </p>
          <p class="break-all text-sm text-(--ui-text-muted)">
            {{ s.baseUrl }}
          </p>
          <p class="text-xs text-(--ui-text-dimmed)">
            {{ t('registry.contribute.serverModels', modelsOn(s.name)) }} · {{ t(`registry.auth.${s.authType}`) }}
          </p>
        </li>
      </ul>
    </template>
  </section>
</template>
