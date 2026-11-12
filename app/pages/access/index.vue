<script setup lang="ts">
import type { TabsItem } from '@nuxt/ui'
import type { ListFilter } from '~/types/list'
import type { AccessRequestRow } from '~/utils/accessRequest'

// Access manager (design A4): who may run which model. Access is a realm role per model
// (`{server}:{process}`) or per model server (`{server}`), created when a model is
// published; access admins hand them out here, directly or by deciding requests (A3).
definePageMeta({ middleware: ['auth', 'access-admin'] })
const { t } = useI18n()
const toast = useToast()

interface AccessUser { id: string, username: string, firstName: string | null, lastName: string | null, email: string | null }
interface ServerRow { name: string, hasRole: boolean, users: number, models: { process: string, users: number }[] }

// Requests first, as in the design; the tab is kept in the URL so a link (or a mail) can
// open it directly.
const route = useRoute()
const router = useRouter()
const tab = computed({
  get: () => route.query.tab === 'models' ? 'models' : 'requests',
  set: (v: string) => { router.replace({ query: { ...route.query, tab: v } }) },
})
const pendingCount = ref<number | null>(null)
const tabs = computed<TabsItem[]>(() => [
  { label: pendingCount.value ? `${t('access.tabs.requests')} · ${pendingCount.value}` : t('access.tabs.requests'), value: 'requests' },
  { label: t('access.tabs.models'), value: 'models' },
])
const requestsTab = ref<{ load: () => Promise<void> } | null>(null)

// Requests: filter by server and status in the ListBar, pending ones first.
const requestFilter = ref<Record<string, string[]>>({ status: ['requested'] })
const requestServers = ref<string[]>([])
const requestFilters = computed<ListFilter[]>(() => [
  {
    key: 'status',
    label: t('access.requests.statusLabel'),
    allLabel: t('access.requests.status.all'),
    items: (['requested', 'granted', 'denied', 'withdrawn', 'revoked'] as const).map(s => ({ value: s, label: t(`access.requests.status.${s}`) })),
  },
  {
    key: 'server',
    label: t('access.requests.server'),
    allLabel: t('access.requests.allServers'),
    items: requestServers.value.map(s => ({ value: s, label: s })),
  },
])

const { data: servers, pending, error, refresh } = useFetch<ServerRow[]>('/api/access/servers', { default: () => [] })

// Model names from the process list; the role only knows the process id.
const { data: processes } = useUmpProcesses()
const titleOf = (id: string) => processes.value?.find(p => p.id === id)?.title ?? id.split(':')[1] ?? id

const search = ref('')
const shown = computed(() => servers.value
  .map(s => ({ ...s, models: s.models.filter(m => matchesSearch(search.value, s.name, m.process, titleOf(`${s.name}:${m.process}`))) }))
  .filter(s => s.models.length || matchesSearch(search.value, s.name)))

// Open servers in the tree and the selection: a model, or a whole server.
const open = ref(new Set<string>())
function toggle(name: string) {
  const next = new Set(open.value)
  if (next.has(name)) next.delete(name)
  else next.add(name)
  open.value = next
}
const selected = ref<{ server: string, process?: string } | null>(null)
const scope = ref<'model' | 'server'>('model')
function select(server: string, process?: string) {
  selected.value = { server, process }
  scope.value = process ? 'model' : 'server'
}
// Start with the first server open and its first model selected.
watch(servers, (list) => {
  const first = list[0]
  if (selected.value || !first) return
  open.value = new Set([first.name])
  select(first.name, first.models[0]?.process)
}, { immediate: true })

const server = computed(() => servers.value.find(s => s.name === selected.value?.server))
const modelId = computed(() => selected.value?.process ? `${selected.value.server}:${selected.value.process}` : '')
const role = computed(() => scope.value === 'model' && modelId.value ? modelId.value : selected.value?.server ?? '')
const scopeItems = computed(() => [
  { label: t('access.thisModel'), value: 'model', disabled: !modelId.value },
  { label: t('access.wholeServer'), value: 'server', disabled: !server.value?.hasRole },
])

// Members of the chosen role. For a model, people with access to the whole server are
// listed too: they can run it, but their access is changed on the server, not here.
const members = ref<(AccessUser & { via: 'model' | 'server' })[]>([])
const membersLoading = ref(false)
async function loadMembers() {
  if (!selected.value || !role.value) return
  membersLoading.value = true
  try {
    const own = await $fetch<AccessUser[]>('/api/access/members', { query: { role: role.value } })
    const viaServer = scope.value === 'model' && server.value?.hasRole
      ? await $fetch<AccessUser[]>('/api/access/members', { query: { role: selected.value.server } })
      : []
    const ownIds = new Set(own.map(u => u.id))
    members.value = [
      ...own.map(u => ({ ...u, via: scope.value })),
      ...viaServer.filter(u => !ownIds.has(u.id)).map(u => ({ ...u, via: 'server' as const })),
    ].sort((a, b) => nameOf(a).localeCompare(nameOf(b)))
  }
  catch (e) {
    members.value = []
    toast.add({ title: t('access.loadFailed'), description: apiErrorMessage(e), color: 'error' })
  }
  finally {
    membersLoading.value = false
  }
}
watch(role, loadMembers, { immediate: true })

const nameOf = (u: AccessUser) => [u.firstName, u.lastName].filter(Boolean).join(' ') || u.username

// A granted request in UMP stays "granted" after the role is taken away, and an open
// request blocks a new one; so revoking also records "revoked" on that request (UMP
// wants a reason, which the person gets by mail).
const { registryApi, umpBase } = useRuntimeConfig().public
async function closeGrantedRequests(userId: string, roleName: string, note: string) {
  if (!registryApi) return
  const page = await $fetch<{ requests: AccessRequestRow[] }>(`${umpBase}/registry/v1/access-requests`, {
    query: { user: userId, status: 'granted', limit: 50 },
  })
  await Promise.all(page.requests.filter(r => r.role === roleName).map(r =>
    $fetch(`${umpBase}/registry/v1/access-requests/${r.id}/transitions`, { method: 'POST', body: { to_status: 'revoked', note } }),
  ))
}
const revoking = ref<(AccessUser & { via: 'model' | 'server' }) | null>(null)
const revokeReason = ref('')
async function revoke() {
  const u = revoking.value
  if (!u || !revokeReason.value.trim()) return
  await change('DELETE', u.id, revokeReason.value.trim())
  revoking.value = null
  revokeReason.value = ''
}

// Account search for "Add access", debounced like the admin search.
const query = ref('')
const found = ref<AccessUser[]>([])
const picked = ref<string | undefined>()
let timer: ReturnType<typeof setTimeout> | undefined
watch(query, (q) => {
  clearTimeout(timer)
  if (q.trim().length < 2) {
    found.value = []
    return
  }
  timer = setTimeout(async () => {
    found.value = await $fetch<AccessUser[]>('/api/access/users', { query: { search: q } }).catch(() => [])
  }, 300)
})
const pickItems = computed(() => found.value.map(u => ({ label: nameOf(u), suffix: u.email ?? u.username, value: u.id })))

const busy = ref<string | null>(null)
async function change(method: 'POST' | 'DELETE', userId: string, note?: string) {
  busy.value = userId
  try {
    await $fetch('/api/access/grants', { method, body: { role: role.value, userId } })
    if (method === 'DELETE' && note) await closeGrantedRequests(userId, role.value, note)
    if (method === 'POST') {
      picked.value = undefined
      query.value = ''
    }
    await Promise.all([loadMembers(), refresh()])
  }
  catch (e) {
    toast.add({ title: t('access.failed'), description: apiErrorMessage(e), color: 'error' })
  }
  finally {
    busy.value = null
  }
}
</script>

<template>
  <section class="mx-auto max-w-6xl space-y-6">
    <PageHeader :title="t('access.title')" :intro="t('access.intro')">
      <UInput
        v-model="search"
        type="search"
        icon="i-lucide-search"
        :placeholder="tab === 'requests' ? t('access.requests.search') : t('access.search')"
        :aria-label="tab === 'requests' ? t('access.requests.search') : t('access.search')"
        class="w-full sm:w-64"
      />
      <UButton color="neutral" variant="outline" icon="i-lucide-refresh-cw" :loading="pending" @click="() => { refresh(); loadMembers(); requestsTab?.load() }">
        {{ t('access.refresh') }}
      </UButton>
    </PageHeader>

    <ListBar v-if="tab === 'requests'" v-model:filter="requestFilter" :filters="requestFilters">
      <UTabs v-model="tab" :items="tabs" :content="false" variant="link" />
    </ListBar>
    <ListBar v-else>
      <UTabs v-model="tab" :items="tabs" :content="false" variant="link" />
    </ListBar>

    <AccessRequests
      v-if="tab === 'requests'"
      ref="requestsTab"
      :search="search"
      :filter="requestFilter"
      @pending="(n: number) => { pendingCount = n }"
      @servers="(names: string[]) => { requestServers = names }"
      @changed="() => { refresh(); loadMembers() }"
    />

    <template v-else>
    <UAlert v-if="error" color="error" variant="subtle" icon="i-lucide-circle-alert" :title="t('access.loadFailed')" :description="apiErrorMessage(error)" />

    <p v-if="!pending && !error && !servers.length" class="text-sm text-(--ui-text-muted)">
      {{ t('access.empty') }}
    </p>

    <div v-else class="grid items-start gap-6 lg:grid-cols-[22rem_minmax(0,1fr)]">
      <ul class="space-y-2 rounded-lg bg-white p-4">
        <li v-for="s in shown" :key="s.name">
          <div
            class="flex items-start gap-2 rounded-md border px-3 py-2"
            :class="selected?.server === s.name && !selected.process ? 'border-(--ui-primary) bg-ufc-blue-50' : 'border-transparent'"
          >
            <UButton
              :icon="open.has(s.name) || search ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'"
              color="neutral"
              variant="ghost"
              size="xs"
              :aria-expanded="open.has(s.name) || !!search"
              :aria-label="s.name"
              @click="toggle(s.name)"
            />
            <button type="button" class="min-w-0 flex-1 text-left" @click="() => { toggle(s.name); if (s.hasRole) select(s.name) }">
              <span class="block text-sm font-medium break-words">{{ s.name }}</span>
              <span class="block text-xs text-(--ui-text-muted)">{{ t('access.models', s.models.length) }} · {{ t('access.users', s.users) }}</span>
            </button>
          </div>
          <ul v-if="open.has(s.name) || search" class="mt-2 ml-6 space-y-2">
            <li v-for="m in s.models" :key="m.process">
              <button
                type="button"
                class="w-full rounded-md border px-3 py-2 text-left"
                :class="selected?.server === s.name && selected.process === m.process ? 'border-(--ui-primary) bg-ufc-blue-50' : 'border-(--ui-border) hover:bg-(--ui-bg-elevated)'"
                :aria-current="selected?.server === s.name && selected.process === m.process"
                @click="select(s.name, m.process)"
              >
                <span class="block text-sm font-medium">{{ titleOf(`${s.name}:${m.process}`) }}</span>
                <span class="block text-xs break-all text-(--ui-text-muted)">{{ s.name }}:{{ m.process }}</span>
              </button>
            </li>
          </ul>
        </li>
      </ul>

      <div v-if="selected" class="rounded-lg bg-white">
        <div class="flex flex-wrap items-start justify-between gap-4 border-b border-(--ui-border) p-6">
          <div class="min-w-0">
            <h2 class="text-lg font-semibold">
              {{ scope === 'model' && modelId ? titleOf(modelId) : selected.server }}
            </h2>
            <p class="text-sm break-all text-(--ui-text-muted)">
              {{ scope === 'model' && modelId ? modelId : t('access.allModels') }}
            </p>
          </div>
          <UTabs v-model="scope" :items="scopeItems" :content="false" size="sm" />
        </div>

        <div class="space-y-3 border-b border-(--ui-border) p-6">
          <h3 class="font-medium">
            {{ t('access.add') }}
          </h3>
          <div class="flex flex-wrap gap-3">
            <UInputMenu
              v-model="picked"
              v-model:search-term="query"
              :items="pickItems"
              value-key="value"
              ignore-filter
              icon="i-lucide-search"
              :placeholder="t('access.findUser')"
              :aria-label="t('access.findUser')"
              class="min-w-0 flex-1"
            />
            <UButton :disabled="!picked" :loading="!!picked && busy === picked" @click="() => { if (picked) change('POST', picked) }">
              {{ t('access.grant') }}
            </UButton>
          </div>
        </div>

        <div class="p-6 pb-2">
          <h3 class="font-medium">
            {{ t('access.withAccess', { n: members.length }) }}
          </h3>
        </div>
        <p v-if="!membersLoading && !members.length" class="px-6 pb-6 text-sm text-(--ui-text-muted)">
          {{ t('access.nobody') }}
        </p>
        <table v-else class="w-full text-left text-sm">
          <thead class="text-xs text-(--ui-text-muted)">
            <tr>
              <th scope="col" class="px-6 py-2 font-medium">
                {{ t('access.col.user') }}
              </th>
              <th scope="col" class="px-6 py-2 font-medium">
                {{ t('access.col.for') }}
              </th>
              <th scope="col" class="px-6 py-2">
                <span class="sr-only">{{ t('access.col.action') }}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="u in members" :key="u.id" class="border-t border-(--ui-border)">
              <td class="px-6 py-3">
                <div class="flex items-center gap-3">
                  <UAvatar :alt="nameOf(u)" size="sm" />
                  <div class="min-w-0">
                    <p class="font-medium">
                      {{ nameOf(u) }}
                    </p>
                    <p class="text-xs text-(--ui-text-muted)">
                      {{ u.username }}
                    </p>
                  </div>
                </div>
              </td>
              <td class="px-6 py-3">
                <UBadge :color="u.via === 'server' ? 'warning' : 'info'" variant="soft" size="sm">
                  {{ u.via === 'server' ? t('access.server') : t('access.thisModel') }}
                </UBadge>
              </td>
              <td class="px-6 py-3 text-right">
                <UButton
                  color="neutral"
                  variant="outline"
                  :disabled="u.via !== scope"
                  :loading="busy === u.id"
                  @click="() => { revoking = u; revokeReason = '' }"
                >
                  {{ t('access.revoke') }}
                </UButton>
              </td>
            </tr>
          </tbody>
        </table>
        <p v-if="scope === 'model' && members.some(u => u.via === 'server')" class="border-t border-(--ui-border) px-6 py-4 text-xs text-(--ui-text-muted)">
          {{ t('access.serverHint') }}
        </p>
      </div>
    </div>
    </template>

    <UModal :open="!!revoking" :title="t('access.revokeTitle', { name: revoking ? nameOf(revoking) : '' })" @update:open="(v: boolean) => { if (!v) revoking = null }">
      <template #body>
        <form id="revoke-access" class="space-y-4" @submit.prevent="revoke">
          <p class="text-sm text-(--ui-text-muted)">
            {{ t('access.revokeIntro') }}
          </p>
          <UFormField :label="t('access.requests.reason')" required>
            <UTextarea v-model="revokeReason" :rows="3" :maxlength="4000" autoresize class="w-full" autofocus />
          </UFormField>
        </form>
      </template>
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton color="neutral" variant="ghost" @click="() => { revoking = null }">
            {{ t('access.requests.cancel') }}
          </UButton>
          <UButton type="submit" form="revoke-access" color="error" :disabled="!revokeReason.trim()" :loading="!!revoking && busy === revoking.id">
            {{ t('access.revoke') }}
          </UButton>
        </div>
      </template>
    </UModal>
  </section>
</template>
