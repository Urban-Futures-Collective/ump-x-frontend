<script setup lang="ts">
import type { TabsItem } from '@nuxt/ui'
import type { ListFilter } from '~/types/list'
import type { RegistryModel, RegistryStatus } from '~/types/registry'
import { REGISTRY_STATUSES } from '~/types/registry'
import type { VerifyTab } from '~/utils/registryWorkflow'
import { VERIFY_TABS, verifyTabsOf } from '~/utils/registryWorkflow'

// Verify (design V1): the models a verifier looks after, in tabs, as a table with the
// next step per row. Drafts are the owner's business and not listed.
definePageMeta({ middleware: ['auth', 'prototype', 'verifier'] })
const { t, locale } = useI18n()
const { models, ownerLabel, actorFor, transition, load, loading, error } = useRegistry()
const toast = useToast()

const tab = ref<VerifyTab>('todo')
const inTab = (key: VerifyTab) => models.value.filter(m => verifyTabsOf(m.status, m.interfaceState).includes(key))
const counts = computed(() => ({
  todo: inTab('todo').length,
  interface: inTab('interface').length,
  published: inTab('published').length,
  closed: inTab('closed').length,
}))
const tabs = computed<TabsItem[]>(() => [
  { label: t('registry.verify.tabs.todo', { n: counts.value.todo }), value: 'todo' },
  { label: t('registry.verify.tabs.interface', { n: counts.value.interface }), value: 'interface' },
  { label: t('registry.verify.tabs.published', { n: counts.value.published }), value: 'published' },
  { label: t('registry.verify.tabs.closed', { n: counts.value.closed }), value: 'closed' },
])

// Search, sort and filter as on every list page (ListBar).
const search = ref('')
const sortBy = ref('changed')
const sortItems = computed(() => [
  { value: 'changed', label: t('list.newest') },
  { value: 'name', label: t('list.name') },
])
const filter = ref<Record<string, string[]>>({})
const filters = computed<ListFilter[]>(() => [{
  key: 'status',
  label: t('registry.contribute.filter'),
  allLabel: t('registry.contribute.filterAll'),
  items: REGISTRY_STATUSES.filter(s => inTab(tab.value).some(m => m.status === s)).map(s => ({ value: s, label: t(`registry.status.${s}`) })),
}])
// A status filter from another tab would hide everything; drop it on switching.
watch(tab, () => { filter.value = {} })
const arrange = (list: RegistryModel[]) => list
  .filter(m => !filter.value.status?.length || filter.value.status.includes(m.status))
  .filter(m => matchesSearch(search.value, title(m), ownerLabel(m), m.serverName, m.remoteProcessId))
  .sort((a, b) => sortBy.value === 'name'
    ? title(a).localeCompare(title(b), locale.value)
    : b.statusChangedAt.localeCompare(a.statusChangedAt))

// Empty states (design E2). Nothing listed at all: just the note, no tabs. Nothing to
// verify, but published models exist: the note, and the published models below it.
const nothingAtAll = computed(() => !loading.value && !error.value && VERIFY_TABS.every(k => !inTab(k).length))
const nothingToVerify = computed(() => tab.value === 'todo' && !loading.value && !inTab('todo').length)
const rows = computed(() => arrange(nothingToVerify.value ? inTab('published') : inTab(tab.value)))

// Models whose server changed its interface (or stopped answering) after verification
// (design V1 notice); the "interface" tab lists them with Compare instead.
const flagged = computed(() => inTab('interface'))
const date = (iso?: string) => iso ? new Date(iso).toLocaleDateString(locale.value, { dateStyle: 'medium' }) : ''
function notice(m: RegistryModel) {
  if (m.interfaceState === 'unreachable') return t('registry.drift.noticeUnreachable', { name: title(m) })
  const status = t(m.status === 'published' ? 'registry.drift.notePublished' : 'registry.drift.noteVerified')
  const first = m.verifiedAt
    ? t('registry.drift.notice', { name: title(m), status, date: date(m.verifiedAt) })
    : t('registry.drift.noticeNoDate', { name: title(m), status })
  return `${first} ${t('registry.drift.noticeAfter')}`
}

const title = (m: RegistryModel) => inLang(m.fullName, locale.value, m.defaultLang) || m.remoteProcessId
const isOwn = (m: RegistryModel) => actorFor(m).isOwner

// "5 days", "1 day", "today": how long the model has waited in its status.
function since(iso: string) {
  if (!iso) return ''
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  return days < 1 ? t('registry.verify.today') : t('registry.verify.days', days)
}

const busy = ref<string | null>(null)
async function step(m: RegistryModel, to: RegistryStatus) {
  busy.value = m.id
  try {
    await transition(m.id, to)
    if (to === 'in_review') await navigateTo(`/verify/${m.id}`)
  }
  catch (e) {
    toast.add({ title: t('registry.failed'), description: apiErrorMessage(e), color: 'error' })
  }
  finally {
    busy.value = null
  }
}
</script>

<template>
  <section class="mx-auto max-w-6xl space-y-6">
    <PrototypeNotice />
    <UAlert v-if="error" color="error" variant="subtle" icon="i-lucide-circle-alert" :title="t('registry.loadFailed')" :description="error" />

    <PageHeader :title="t('registry.verify.title')" :intro="t('registry.verify.intro')">
      <UInput
        v-if="!nothingAtAll"
        v-model="search"
        type="search"
        icon="i-lucide-search"
        :placeholder="t('registry.verify.search')"
        :aria-label="t('registry.verify.search')"
        class="w-full sm:w-64"
      />
      <UButton color="neutral" variant="outline" icon="i-lucide-refresh-cw" :loading="loading" @click="() => { load(true) }">
        {{ t('registry.verify.refresh') }}
      </UButton>
    </PageHeader>

    <ListBar v-if="!nothingAtAll" v-model:sort="sortBy" v-model:filter="filter" :sort-items="sortItems" :filters="filters">
      <UTabs v-model="tab" :items="tabs" :content="false" variant="link" />
    </ListBar>

    <div v-if="nothingAtAll || nothingToVerify" class="flex flex-wrap items-center gap-3 rounded-lg border border-(--ui-border) bg-white px-5 py-4" role="status">
      <UBadge color="neutral" variant="soft">
        {{ t('registry.verify.noneBadge') }}
      </UBadge>
      <span>{{ t('registry.verify.noneText') }}</span>
    </div>

    <template v-if="tab !== 'interface'">
      <div
        v-for="m in flagged"
        :key="m.id"
        class="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-(--ui-warning)/50 bg-white px-4 py-3 text-sm"
        role="status"
      >
        <UBadge color="warning" variant="subtle">
          {{ t(`registry.drift.badge.${m.interfaceState}`) }}
        </UBadge>
        <p class="min-w-0 flex-1">
          {{ notice(m) }}
        </p>
        <UButton color="neutral" variant="outline" :to="`/verify/${m.id}/interface`">
          {{ t('registry.drift.compare') }}
        </UButton>
      </div>
    </template>

    <p v-if="!rows.length && !nothingAtAll && !nothingToVerify" class="text-sm text-(--ui-text-muted)">
      {{ loading ? t('registry.loading') : search || filter.status?.length ? t('registry.noMatch') : t(`registry.verify.empty.${tab}`) }}
    </p>

    <div v-if="rows.length" class="overflow-x-auto rounded-lg border border-(--ui-border) bg-white">
      <table class="w-full min-w-[40rem] text-left text-sm">
        <thead class="text-xs text-(--ui-text-muted)">
          <tr>
            <th scope="col" class="px-4 py-3 font-medium">
              {{ t('registry.verify.col.model') }}
            </th>
            <th scope="col" class="px-4 py-3 font-medium">
              {{ t('registry.verify.col.owner') }}
            </th>
            <th scope="col" class="px-4 py-3 font-medium">
              {{ t('registry.verify.col.status') }}
            </th>
            <th scope="col" class="px-4 py-3 font-medium">
              {{ t('registry.verify.col.since') }}
            </th>
            <th scope="col" class="px-4 py-3">
              <span class="sr-only">{{ t('registry.verify.col.action') }}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="m in rows" :key="m.id" class="border-t border-(--ui-border)">
            <td class="px-4 py-3">
              <ULink :to="`/verify/${m.id}`" class="font-medium text-(--ui-text-highlighted) hover:text-(--ui-primary)">
                {{ title(m) }}
              </ULink>
              <p class="text-xs text-(--ui-text-dimmed)">
                {{ m.serverName }}:{{ m.remoteProcessId }}
              </p>
            </td>
            <td class="px-4 py-3">
              {{ isOwn(m) ? t('registry.verify.you') : ownerLabel(m) }}
            </td>
            <td class="px-4 py-3">
              <RegistryStatusBadge :status="m.status" />
            </td>
            <td class="px-4 py-3 text-(--ui-text-muted)">
              {{ since(m.statusChangedAt) }}
            </td>
            <td class="px-4 py-3 text-right">
              <!-- Four-eyes: nobody reviews their own model. -->
              <UButton v-if="tab === 'interface'" color="neutral" variant="outline" :to="`/verify/${m.id}/interface`">
                {{ t('registry.drift.compare') }}
              </UButton>
              <p v-else-if="isOwn(m) && tab === 'todo'" class="ml-auto max-w-56 text-xs text-(--ui-text-muted)">
                {{ t('registry.verify.ownModel') }}
              </p>
              <UButton v-else-if="m.status === 'submitted'" :loading="busy === m.id" @click="step(m, 'in_review')">
                {{ t('registry.action.in_review') }}
              </UButton>
              <UButton v-else-if="m.status === 'verified'" variant="soft" :loading="busy === m.id" @click="step(m, 'published')">
                {{ t('registry.action.published') }}
              </UButton>
              <UButton v-else-if="m.status === 'in_review'" variant="outline" :to="`/verify/${m.id}`">
                {{ t('registry.verify.continue') }}
              </UButton>
              <UButton v-else variant="ghost" color="neutral" trailing-icon="i-lucide-arrow-right" :to="`/verify/${m.id}`">
                {{ t('registry.verify.open') }}
              </UButton>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
