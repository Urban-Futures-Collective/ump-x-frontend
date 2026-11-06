<script setup lang="ts">
import type { RegistryModel, RegistryServer } from '~/types/registry'

// Model servers for platform admins (design A5): every registered server with owner,
// login, state and models, possible duplicates (same base URL) grouped on top. A server
// can be deleted once none of its models is live or under review; a row opens the
// details (A5.1). Search and filters come from the page (header and ListBar).
const props = defineProps<{ search: string, filter: Record<string, string[]> }>()
const emit = defineEmits<{ clearFilters: [] }>()
const { t, locale } = useI18n()
const { servers, models, loading, error, load, mySub, myName } = useRegistry()

// UMP only knows the owner's account id; the names come from Keycloak.
const names = ref<Record<string, string>>({})
watch(() => servers.value.map(s => s.ownerSub).join(','), async (ids) => {
  const missing = [...new Set(ids.split(','))].filter(id => id && !(id in names.value))
  if (!missing.length) return
  try {
    names.value = { ...names.value, ...await $fetch<Record<string, string>>('/api/admin/platform/names', { query: { ids: missing.join(',') } }) }
  }
  catch {
    // Without names the account id stays visible below; nothing else depends on it.
  }
}, { immediate: true })

function ownerOf(s: RegistryServer): string {
  if (s.ownerSub === mySub.value && myName.value) return myName.value
  return names.value[s.ownerSub]
    || models.value.find(m => m.ownerSub === s.ownerSub && m.ownerName)?.ownerName
    || t('registry.otherOwner')
}
const shortId = (id: string) => id.length > 12 ? `${id.slice(0, 4)}…${id.slice(-4)}` : id
const date = (iso?: string) => iso ? new Date(iso).toLocaleDateString(locale.value, { dateStyle: 'medium' }) : ''
const titleOf = (m: RegistryModel) => inLang(m.fullName, locale.value, m.defaultLang) || m.remoteProcessId

interface Row {
  server: RegistryServer
  owner: string
  models: RegistryModel[]
  blocking: RegistryModel[]
}
const rows = computed<Row[]>(() => servers.value.map((s) => {
  const list = modelsOfServer(s, models.value)
  return { server: s, owner: ownerOf(s), models: list, blocking: blockingModels(list) }
}))

const shown = computed(() => {
  const state = props.filter.state?.[0]
  const deletable = props.filter.deletable?.[0]
  return rows.value
    .filter(r => !state || (state === 'active') === (r.server.isActive !== false))
    .filter(r => !deletable || (deletable === 'yes') === !r.blocking.length)
    .filter(r => matchesSearch(props.search, r.server.name, r.server.baseUrl, r.owner))
})
const filtered = computed(() => !!props.search.trim() || Object.values(props.filter).some(v => v.length))

const groups = computed(() => groupByBaseUrl(shown.value.map(r => ({ ...r, name: r.server.name, baseUrl: r.server.baseUrl }))))
const duplicateGroups = computed(() => groups.value.filter(g => g.baseUrl).length)
function groupSummary(list: Row[]) {
  const owners = new Set(list.map(r => r.server.ownerSub)).size
  return [
    t('admin.servers.sameUrl'),
    owners > 1 ? t('admin.servers.owners', { n: owners }) : t('admin.servers.sameOwner'),
    t('admin.servers.deletableOf', { n: list.filter(r => !r.blocking.length).length, total: list.length }),
  ].join(' · ')
}
const breakdown = (list: RegistryModel[]) => statusCounts(list).map(c => `${c.n} ${t(`registry.status.${c.status}`)}`).join(' · ')

// Details drawer (A5.1) and the delete dialog (A5.2).
const openId = ref<string | null>(null)
const open = computed(() => rows.value.find(r => r.server.id === openId.value) ?? null)
const deleting = ref<Row | null>(null)
// A deletion refused with 412: something changed since the list was read (A5.4).
const stale = ref<string | null>(null)
async function reload() {
  stale.value = null
  await load(true)
}
defineExpose({ reload })

function duplicatesOf(r: Row) {
  const url = normalizeBaseUrl(r.server.baseUrl)
  return rows.value.filter(o => o !== r && normalizeBaseUrl(o.server.baseUrl) === url)
}
</script>

<template>
  <div class="space-y-4">
    <UAlert
      v-if="stale"
      color="warning"
      variant="subtle"
      icon="i-lucide-triangle-alert"
      :title="t('admin.servers.staleTitle', { name: stale })"
      :description="t('admin.servers.staleText')"
      :actions="[{ label: t('admin.servers.reload'), color: 'neutral', variant: 'outline', onClick: reload }]"
    />

    <UAlert v-if="error" color="error" variant="subtle" icon="i-lucide-circle-alert" :title="t('admin.servers.loadFailed')" :description="error" />

    <div v-else class="overflow-x-auto rounded-lg bg-white">
      <table class="w-full text-left text-sm">
        <thead class="text-xs text-(--ui-text-muted)">
          <tr>
            <th scope="col" class="px-4 py-3 font-medium">
              {{ t('admin.servers.col.server') }}
            </th>
            <th scope="col" class="hidden px-4 py-3 font-medium lg:table-cell">
              {{ t('admin.servers.col.baseUrl') }}
            </th>
            <th scope="col" class="px-4 py-3 font-medium">
              {{ t('admin.servers.col.owner') }}
            </th>
            <th scope="col" class="hidden px-4 py-3 font-medium md:table-cell">
              {{ t('admin.servers.col.auth') }}
            </th>
            <th scope="col" class="hidden px-4 py-3 font-medium sm:table-cell">
              {{ t('admin.servers.col.state') }}
            </th>
            <th scope="col" class="px-4 py-3 font-medium">
              {{ t('admin.servers.col.models') }}
            </th>
            <th scope="col" class="hidden px-4 py-3 font-medium xl:table-cell">
              {{ t('admin.servers.col.discovered') }}
            </th>
            <th scope="col" class="px-4 py-3 font-medium">
              {{ t('admin.servers.col.deletable') }}
            </th>
            <th scope="col" class="px-4 py-3">
              <span class="sr-only">{{ t('admin.servers.col.actions') }}</span>
            </th>
          </tr>
        </thead>

        <!-- Loading (A5.7): the deletable column needs every model status first. -->
        <tbody v-if="loading && !servers.length">
          <tr v-for="i in 6" :key="i" class="border-t border-(--ui-border)">
            <td v-for="j in 9" :key="j" class="px-4 py-4">
              <USkeleton class="h-4 w-full max-w-28" />
            </td>
          </tr>
        </tbody>

        <!-- Empty (A5.6): nothing registered, or nothing matches the filters. -->
        <tbody v-else-if="!shown.length">
          <tr>
            <td colspan="9" class="px-4 py-16 text-center">
              <p class="font-medium text-(--ui-text-highlighted)">
                {{ filtered ? t('admin.servers.noMatch') : t('admin.servers.empty') }}
              </p>
              <p v-if="!filtered" class="mx-auto mt-1 max-w-md text-sm text-(--ui-text-muted)">
                {{ t('admin.servers.emptyText') }}
              </p>
              <UButton class="mt-4" color="neutral" variant="outline" @click="filtered ? emit('clearFilters') : reload()">
                {{ filtered ? t('admin.servers.clearFilters') : t('admin.servers.reload') }}
              </UButton>
            </td>
          </tr>
        </tbody>

        <tbody v-for="g in groups" v-else :key="g.baseUrl || 'other'">
          <!-- Group header; "other servers" only needs one when there are duplicate groups. -->
          <tr v-if="g.baseUrl || duplicateGroups" class="border-t border-(--ui-border)" :class="g.baseUrl ? 'bg-ufc-gold-50' : ''">
            <td colspan="9" class="px-4 py-2.5">
              <span v-if="g.baseUrl" class="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span class="flex items-center gap-1.5 font-medium">
                  <UIcon name="i-lucide-copy" class="size-4" aria-hidden="true" />
                  {{ t('admin.servers.group', { n: g.servers.length, url: g.baseUrl }) }}
                </span>
                <span class="text-xs text-(--ui-text-muted)">{{ groupSummary(g.servers) }}</span>
              </span>
              <span v-else class="font-medium text-(--ui-text-muted)">
                {{ t('admin.servers.other', { n: g.servers.length }) }}
              </span>
            </td>
          </tr>
          <tr
            v-for="r in g.servers"
            :key="r.server.id"
            class="cursor-pointer border-t border-(--ui-border) align-top hover:bg-(--ui-bg-elevated)/50"
            @click="openId = r.server.id"
          >
            <td class="px-4 py-3">
              <button type="button" class="text-left font-medium whitespace-nowrap text-(--ui-text-highlighted) hover:underline" @click.stop="openId = r.server.id">
                {{ r.server.name }}
              </button>
              <p v-if="r.server.createdAt" class="text-xs text-(--ui-text-muted)">
                {{ t('admin.servers.created', { date: date(r.server.createdAt) }) }}
              </p>
            </td>
            <td class="hidden max-w-44 truncate px-4 py-3 lg:table-cell" :title="r.server.baseUrl">
              {{ r.server.baseUrl }}
            </td>
            <td class="px-4 py-3">
              <p class="whitespace-nowrap">
                {{ r.owner }}
              </p>
              <p class="text-xs text-(--ui-text-muted)">
                {{ shortId(r.server.ownerSub) }}
              </p>
            </td>
            <td class="hidden px-4 py-3 md:table-cell">
              <p>{{ t(`registry.auth.${r.server.authType}`) }}</p>
              <p class="text-xs text-(--ui-text-muted)">
                {{ r.server.hasCredentials ? t('admin.servers.credentials') : t('admin.servers.noCredentials') }}
              </p>
            </td>
            <td class="hidden px-4 py-3 sm:table-cell">
              <UBadge :color="r.server.isActive === false ? 'neutral' : 'success'" variant="soft" size="sm">
                {{ r.server.isActive === false ? t('admin.servers.inactive') : t('admin.servers.active') }}
              </UBadge>
            </td>
            <td class="px-4 py-3">
              <p>{{ t('registry.contribute.serverModels', r.models.length) }}</p>
              <p class="max-w-48 truncate text-xs text-(--ui-text-muted)">
                {{ breakdown(r.models) || '–' }}
              </p>
            </td>
            <td class="hidden px-4 py-3 xl:table-cell">
              {{ r.server.lastDiscoveredAt ? date(r.server.lastDiscoveredAt) : t('admin.servers.never') }}
            </td>
            <td class="px-4 py-3">
              <UBadge v-if="r.blocking.length" color="warning" variant="soft" size="sm" class="whitespace-nowrap">
                {{ t('admin.servers.blocked', { n: r.blocking.length }) }}
              </UBadge>
              <UBadge v-else color="success" variant="soft" size="sm">
                {{ t('admin.servers.deletable') }}
              </UBadge>
            </td>
            <td class="px-4 py-3 text-right">
              <UTooltip :text="r.blocking.length ? t('admin.servers.blockedBy', { list: r.blocking.map(m => `${titleOf(m)} (${t(`registry.status.${m.status}`)})`).join(', ') }) : ''" :disabled="!r.blocking.length">
                <UButton color="neutral" variant="outline" size="sm" :disabled="!!r.blocking.length" @click.stop="() => { deleting = r }">
                  {{ t('admin.servers.delete') }}
                </UButton>
              </UTooltip>
            </td>
          </tr>
        </tbody>
      </table>
      <p v-if="shown.length" class="border-t border-(--ui-border) px-4 py-3 text-xs text-(--ui-text-muted)">
        {{ t('admin.servers.footer', { n: shown.length, groups: duplicateGroups }) }}
      </p>
    </div>

    <!-- Details (A5.1). -->
    <USlideover :open="!!open" :title="open?.server.name" @update:open="(v: boolean) => { if (!v) openId = null }">
      <template #description>
        <span class="flex flex-wrap items-center gap-2">
          <UBadge :color="open?.server.isActive === false ? 'neutral' : 'success'" variant="soft" size="sm">
            {{ open?.server.isActive === false ? t('admin.servers.inactive') : t('admin.servers.active') }}
          </UBadge>
          <UBadge v-if="open?.blocking.length" color="warning" variant="soft" size="sm">
            {{ t('admin.servers.blocked', { n: open.blocking.length }) }}
          </UBadge>
          <span class="text-xs">{{ t('admin.servers.idLabel', { id: open?.server.id }) }}</span>
        </span>
      </template>
      <template #body>
        <div v-if="open" class="space-y-6 text-sm">
          <div v-if="duplicatesOf(open).length" class="rounded-lg border border-ufc-gold-500 bg-ufc-gold-50 p-4">
            <p class="flex items-center gap-1.5 font-medium">
              <UIcon name="i-lucide-copy" class="size-4" aria-hidden="true" />
              {{ t('admin.servers.duplicate') }}
            </p>
            <p class="mt-1 text-(--ui-text-muted)">
              {{ t('admin.servers.duplicateText', { n: duplicatesOf(open).length, url: normalizeBaseUrl(open.server.baseUrl), list: duplicatesOf(open).map(d => `${d.server.name} (${d.owner})`).join(', ') }) }}
            </p>
          </div>

          <section class="space-y-3">
            <h3 class="font-medium">
              {{ t('admin.servers.details') }}
            </h3>
            <dl class="grid grid-cols-[minmax(0,10rem)_1fr] gap-x-4 gap-y-3">
              <dt class="text-(--ui-text-muted)">
                {{ t('admin.servers.name') }}
              </dt>
              <dd>
                {{ open.server.name }}
                <p class="text-xs text-(--ui-text-muted)">
                  {{ t('admin.servers.nameHint', { name: open.server.name }) }}
                </p>
              </dd>
              <dt class="text-(--ui-text-muted)">
                {{ t('admin.servers.col.baseUrl') }}
              </dt>
              <dd class="break-all">
                {{ open.server.baseUrl }}
              </dd>
              <dt class="text-(--ui-text-muted)">
                {{ t('admin.servers.col.owner') }}
              </dt>
              <dd>
                {{ open.owner }}
                <p class="text-xs break-all text-(--ui-text-muted)">
                  {{ open.server.ownerSub }}
                </p>
              </dd>
              <dt class="text-(--ui-text-muted)">
                {{ t('admin.servers.col.auth') }}
              </dt>
              <dd>
                {{ t(`registry.auth.${open.server.authType}`) }} · {{ open.server.hasCredentials ? t('admin.servers.credentials') : t('admin.servers.noCredentials') }}
                <p class="text-xs text-(--ui-text-muted)">
                  {{ t('admin.servers.secretsHidden') }}
                </p>
              </dd>
              <dt class="text-(--ui-text-muted)">
                {{ t('admin.servers.col.discovered') }}
              </dt>
              <dd>{{ open.server.lastDiscoveredAt ? date(open.server.lastDiscoveredAt) : t('admin.servers.never') }}</dd>
              <dt class="text-(--ui-text-muted)">
                {{ t('admin.servers.createdUpdated') }}
              </dt>
              <dd>{{ [date(open.server.createdAt), date(open.server.updatedAt)].filter(Boolean).join(' · ') || '–' }}</dd>
            </dl>
          </section>

          <section class="space-y-3">
            <h3 class="font-medium">
              {{ t('admin.servers.modelsHeading', { n: open.models.length }) }}
            </h3>
            <p class="text-(--ui-text-muted)">
              {{ t('admin.servers.modelsRule', { n: open.blocking.length }) }}
            </p>
            <ul v-if="open.models.length" class="divide-y divide-(--ui-border) rounded-lg border border-(--ui-border)">
              <li v-for="m in open.models" :key="m.id" class="flex items-start justify-between gap-3 px-4 py-3" :class="open.blocking.includes(m) ? 'bg-ufc-gold-50' : ''">
                <div class="min-w-0">
                  <!-- Own models link to their card; others' cards are not open to admins. -->
                  <ULink v-if="m.ownerSub === mySub" :to="`/contribute/${m.id}`" class="font-medium text-(--ui-primary) hover:underline">
                    {{ titleOf(m) }}
                  </ULink>
                  <p v-else class="font-medium">
                    {{ titleOf(m) }}
                  </p>
                  <p class="text-xs text-(--ui-text-muted)">
                    {{ m.serverName }}:{{ m.remoteProcessId }}
                  </p>
                </div>
                <div class="flex shrink-0 items-center gap-2">
                  <UBadge color="neutral" variant="soft" size="sm">
                    {{ t(`registry.status.${m.status}`) }}
                  </UBadge>
                  <span class="text-xs" :class="open.blocking.includes(m) ? 'text-amber-700' : 'text-(--ui-text-muted)'">
                    {{ open.blocking.includes(m) ? t('admin.servers.blocks') : t('admin.servers.okToDelete') }}
                  </span>
                </div>
              </li>
            </ul>
          </section>

          <section class="space-y-3 rounded-lg border border-red-300 p-4">
            <h3 class="font-medium text-red-700">
              {{ t('admin.servers.danger') }}
            </h3>
            <p class="text-(--ui-text-muted)">
              {{ t('admin.servers.dangerText') }}
            </p>
            <div class="flex flex-wrap items-center gap-3">
              <UButton color="error" variant="outline" :disabled="!!open.blocking.length" @click="() => { deleting = open; openId = null }">
                {{ t('admin.servers.deleteServer') }}
              </UButton>
              <p v-if="open.blocking.length" class="text-xs text-amber-700">
                {{ t('admin.servers.blockedHint', { n: open.blocking.length }) }}
              </p>
            </div>
          </section>
        </div>
      </template>
    </USlideover>

    <ServerDeleteModal
      :server="deleting?.server ?? null"
      :owner="deleting?.owner"
      @close="deleting = null"
      @stale="(name: string) => { stale = name }"
    />
  </div>
</template>
