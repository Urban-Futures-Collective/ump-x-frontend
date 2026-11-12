<script setup lang="ts">
import type { TabsItem } from '@nuxt/ui'
import type { ListFilter } from '~/types/list'
import type { RegistryModel, RegistryServer, RegistryStatus } from '~/types/registry'
import { REGISTRY_STATUSES } from '~/types/registry'
import { CONTRIBUTE_GROUPS, contributeGroup } from '~/utils/registryWorkflow'
import type { ContributeGroup } from '~/utils/registryWorkflow'

// Contribute (design P1): the signed-in provider's models, grouped by who has to act
// next, and their model servers. Prototype with sample data (see useRegistry).
definePageMeta({ middleware: ['auth', 'prototype', 'provider'] })
const { t, locale } = useI18n()
const { myModels, myServers, loading, error } = useRegistry()

// Nothing contributed yet (design E1): one invitation instead of empty tabs and tools.
// The servers tab only matters once there is a model; a server is registered with it.
const isEmpty = computed(() => !loading.value && !error.value && !myModels.value.length)

const tab = ref<'models' | 'servers'>('models')
const tabs = computed<TabsItem[]>(() => [
  { label: t('registry.contribute.tabModels', { n: myModels.value.length }), value: 'models' },
  { label: t('registry.contribute.tabServers', { n: myServers.value.length }), value: 'servers' },
])

const search = ref('')
const sortBy = ref('changed')
const filter = ref<Record<string, string[]>>({})
const statusFilter = computed(() => (filter.value.status?.[0] ?? 'all') as RegistryStatus | 'all')
const tiles = ref(false)

const titleOf = (m: RegistryModel) => inLang(m.fullName, locale.value, m.defaultLang) || m.remoteProcessId

const sortItems = computed(() => [
  { value: 'changed', label: t('registry.contribute.sortChanged') },
  { value: 'name', label: t('registry.contribute.sortName') },
])

// Only statuses the owner actually has, so the filter never offers an empty result.
const filters = computed<ListFilter[]>(() => [{
  key: 'status',
  label: t('registry.contribute.filter'),
  allLabel: t('registry.contribute.filterAll'),
  items: REGISTRY_STATUSES.filter(s => myModels.value.some(m => m.status === s)).map(s => ({ value: s, label: t(`registry.status.${s}`) })),
}])

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

// The server whose edit dialog is open (only own servers are listed here).
const editing = ref<RegistryServer | null>(null)
// Deleting a server takes its models along; only while none of them is live or under
// review (UMP checks again).
const { models, myName, load } = useRegistry()
const blockingOn = (s: RegistryServer) => blockingModels(modelsOfServer(s, models.value))
const deleting = ref<RegistryServer | null>(null)
const stale = ref<string | null>(null)
</script>

<template>
  <section class="mx-auto max-w-6xl space-y-6">
    <PrototypeNotice />
    <UAlert v-if="error" color="error" variant="subtle" icon="i-lucide-circle-alert" :title="t('registry.loadFailed')" :description="error" />

    <PageHeader :title="t('registry.contribute.title')" :intro="t('registry.contribute.intro')">
      <template v-if="!isEmpty">
        <UInput
          v-model="search"
          icon="i-lucide-search"
          :placeholder="t(tab === 'models' ? 'registry.contribute.searchModels' : 'registry.contribute.searchServers')"
          :aria-label="t(tab === 'models' ? 'registry.contribute.searchModels' : 'registry.contribute.searchServers')"
          class="w-full sm:w-64"
        />
        <UButton icon="i-lucide-plus" to="/contribute/new">
          {{ t('registry.contribute.new') }}
        </UButton>
      </template>
    </PageHeader>

    <!-- Centred in the free space below the heading, as in the design. -->
    <div v-if="isEmpty" class="flex min-h-[55vh] items-center justify-center">
      <div class="w-full max-w-xl space-y-6 rounded-lg border border-(--ui-border) bg-white px-6 py-10 text-center">
        <p class="text-lg font-medium text-(--ui-text-highlighted)">
          {{ t('registry.contribute.emptyTitle') }}
        </p>
        <div class="flex flex-wrap items-center justify-center gap-x-12 gap-y-4">
          <UButton to="/contribute/new">
            {{ t('registry.contribute.emptyCreate') }}
          </UButton>
          <ULink to="/help" class="font-medium text-(--ui-primary)">
            {{ t('registry.contribute.emptyHelp') }}
          </ULink>
        </div>
      </div>
    </div>

    <ListBar
      v-else-if="tab === 'models'"
      v-model:sort="sortBy"
      v-model:filter="filter"
      v-model:tiles="tiles"
      :sort-items="sortItems"
      :filters="filters"
    >
      <UTabs v-model="tab" :items="tabs" :content="false" variant="link" />
    </ListBar>
    <ListBar v-else>
      <UTabs v-model="tab" :items="tabs" :content="false" variant="link" />
    </ListBar>

    <template v-if="!isEmpty && tab === 'models'">
      <p v-if="loading && !myModels.length" class="text-sm text-(--ui-text-muted)">
        {{ t('registry.loading') }}
      </p>
      <p v-else-if="!groups.length" class="text-sm text-(--ui-text-muted)">
        {{ t('registry.noMatch') }}
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

    <template v-else-if="!isEmpty">
      <h2 class="text-lg font-semibold">
        {{ t('registry.contribute.servers') }}
      </h2>
      <UAlert
        v-if="stale"
        color="warning"
        variant="subtle"
        icon="i-lucide-triangle-alert"
        :title="t('admin.servers.staleTitle', { name: stale })"
        :description="t('admin.servers.staleText')"
        :actions="[{ label: t('admin.servers.reload'), color: 'neutral', variant: 'outline', onClick: () => { stale = null; load(true) } }]"
      />
      <p v-if="!servers.length" class="text-sm text-(--ui-text-muted)">
        {{ search ? t('registry.noMatch') : t('registry.contribute.serversEmpty') }}
      </p>
      <ul v-else class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <li v-for="s in servers" :key="s.id" class="space-y-1 rounded-lg border border-(--ui-border) bg-white p-4">
          <div class="flex items-start justify-between gap-2">
            <p class="font-semibold text-(--ui-text-highlighted)">
              {{ s.name }}
              <UBadge v-if="s.isActive === false" color="neutral" variant="soft" size="sm" class="ml-1 align-middle">
                {{ t('registry.server.inactive') }}
              </UBadge>
            </p>
            <div class="flex shrink-0">
              <UButton color="neutral" variant="ghost" size="sm" icon="i-lucide-pencil" :aria-label="t('registry.server.edit', { name: s.name })" @click="() => { editing = s }" />
              <UTooltip :text="blockingOn(s).length ? t('registry.serverDelete.blockedTip', { n: blockingOn(s).length }) : t('registry.serverDelete.open', { name: s.name })">
                <UButton
                  color="neutral"
                  variant="ghost"
                  size="sm"
                  icon="i-lucide-trash-2"
                  :disabled="!!blockingOn(s).length"
                  :aria-label="t('registry.serverDelete.open', { name: s.name })"
                  @click="() => { deleting = s }"
                />
              </UTooltip>
            </div>
          </div>
          <p class="break-all text-sm text-(--ui-text-muted)">
            {{ s.baseUrl }}
          </p>
          <p class="text-xs text-(--ui-text-dimmed)">
            {{ t('registry.contribute.serverModels', modelsOn(s.name)) }} · {{ t(`registry.auth.${s.authType}`) }}
          </p>
        </li>
      </ul>
      <ServerEditModal :server="editing" @close="() => { editing = null }" />
      <ServerDeleteModal :server="deleting" :owner="myName" @close="() => { deleting = null }" @stale="(name: string) => { stale = name }" />
    </template>
  </section>
</template>
