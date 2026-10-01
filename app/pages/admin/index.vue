<script setup lang="ts">
// Administration. auth + admin middleware: only reachable with an admin role; order
// matters (session first, then role). The middleware only hides UI; the data is protected
// server-side in every route under server/api/admin/.
//
// Currently only the platform admin section: list accounts page by page, create them with
// an email invitation, enable and disable them, assign platform roles.
import type { TableColumn } from '@nuxt/ui'

definePageMeta({ middleware: ['auth', 'admin'] })
const { t } = useI18n()
const { isPlatformAdmin } = useUmpRoles()
const { user } = useOidcAuth()
const ownId = computed(() => (user.value?.userInfo as { sub?: string } | undefined)?.sub ?? null)

// The account whose roles are open in the dialog.
const rolesFor = ref<{ id: string, username: string } | null>(null)
const dialogOpen = computed({
  get: () => rolesFor.value !== null,
  set: (open) => {
    if (open) return
    rolesFor.value = null
    // The badges in the list may have changed.
    refresh()
  },
})

// Create-account dialog. Closing it after a successful creation resets the form.
const createOpen = ref(false)
const createKey = ref(0)
watch(createOpen, (open) => { if (!open) createKey.value++ })

// Re-sending the invitation, e.g. when it did not arrive or the link expired.
const inviteInfo = ref<string | null>(null)
async function resendInvitation(a: Account) {
  statusError.value = null
  inviteInfo.value = null
  statusSaving.value = a.id
  try {
    await $fetch(`/api/admin/platform/users/${a.id}/invite`, { method: 'POST' })
    inviteInfo.value = t('admin.users.invitationSent', { name: a.username })
  }
  catch (e) {
    statusError.value = (e as { data?: { statusMessage?: string } }).data?.statusMessage ?? String(e)
  }
  finally {
    statusSaving.value = null
  }
}

// The account about to be disabled. Disabling asks for confirmation because it signs the
// user out immediately; enabling does not.
const toDisable = ref<{ id: string, username: string } | null>(null)
const confirmOpen = computed({
  get: () => toDisable.value !== null,
  set: (open) => { if (!open) toDisable.value = null },
})
const statusSaving = ref<string | null>(null)
const statusError = ref<string | null>(null)

async function setEnabled(id: string, enable: boolean) {
  statusError.value = null
  statusSaving.value = id
  try {
    await $fetch(`/api/admin/platform/users/${id}`, { method: 'PATCH', body: { enabled: enable } })
    toDisable.value = null
    await refresh()
  }
  catch (e) {
    statusError.value = (e as { data?: { statusMessage?: string } }).data?.statusMessage ?? String(e)
  }
  finally {
    statusSaving.value = null
  }
}

interface Account {
  id: string
  username: string
  email: string | null
  firstName: string | null
  lastName: string | null
  enabled: boolean
  roles: BadgeRole[]
  missing: DefaultRole[]
}
type BadgeRole = typeof BADGE_ROLES[number]
type DefaultRole = typeof DEFAULT_ROLES[number]

// Display name for a row: first and last name if Keycloak has them, else the username.
function displayName(a: Account): string {
  return [a.firstName, a.lastName].filter(Boolean).join(' ') || a.username
}
function initialsOf(a: Account): string {
  if (a.firstName && a.lastName) return (a.firstName[0]! + a.lastName[0]!).toUpperCase()
  return a.username.slice(0, 2).toUpperCase()
}

// One column for the person (avatar, name, username) instead of two, so a row reads as
// one unit. Email hides on narrow screens. Actions sit in a per-row menu, which leaves
// room for the actions still to come without widening the table.
const columns: TableColumn<Account>[] = [
  { id: 'person', accessorFn: displayName, header: () => t('admin.users.person') },
  { accessorKey: 'email', header: () => t('admin.users.email'), meta: { class: { th: 'hidden md:table-cell', td: 'hidden md:table-cell' } } },
  { id: 'roles', header: () => t('admin.users.roles'), enableSorting: false, meta: { class: { th: 'hidden sm:table-cell', td: 'hidden sm:table-cell' } } },
  { accessorKey: 'enabled', header: () => t('admin.users.status') },
  { id: 'actions', enableSorting: false, meta: { class: { td: 'text-right w-0' } } },
]
// Sorting only reorders the current page; Keycloak returns accounts by username and
// cannot sort by anything else.
const sorting = ref([{ id: 'person', desc: false }])

function actionsFor(a: Account) {
  const self = a.id === ownId.value
  return [[
    {
      label: t('admin.users.roles'),
      icon: 'i-lucide-shield-check',
      onSelect: () => { rolesFor.value = { id: a.id, username: a.username } },
    },
    {
      label: t('admin.users.resendInvitation'),
      icon: 'i-lucide-send',
      disabled: !a.email || statusSaving.value !== null,
      onSelect: () => { resendInvitation(a) },
    },
  ], [
    a.enabled
      ? {
          label: self ? t('admin.users.ownAccount') : t('admin.users.disable'),
          icon: 'i-lucide-user-x',
          color: 'error' as const,
          disabled: self || statusSaving.value !== null,
          onSelect: () => { toDisable.value = { id: a.id, username: a.username } },
        }
      : {
          label: t('admin.users.enable'),
          icon: 'i-lucide-user-check',
          disabled: statusSaving.value !== null,
          onSelect: () => { setEnabled(a.id, true) },
        },
  ]]
}

// The list loads one page at a time. The search term applies when the form is submitted,
// not on every keystroke, and starts again at page one.
const PAGE_SIZE = 25
const searchTerm = ref('')
const appliedSearch = ref('')
const page = ref(1)
const { data, pending, error, refresh } = await useFetch<{ accounts: Account[], total: number }>('/api/admin/platform/users', {
  query: computed(() => ({ search: appliedSearch.value, first: (page.value - 1) * PAGE_SIZE, max: PAGE_SIZE })),
  immediate: isPlatformAdmin.value,
  default: () => ({ accounts: [], total: 0 }),
})
const accounts = computed(() => data.value.accounts)
const total = computed(() => data.value.total)

function search() {
  page.value = 1
  if (appliedSearch.value === searchTerm.value) refresh()
  else appliedSearch.value = searchTerm.value
}
</script>

<template>
  <div class="space-y-6">
    <h1 class="text-2xl font-semibold text-ufc-slate-900">
      {{ t('admin.title') }}
    </h1>

    <!-- Not full width on purpose: on wide screens a long row is hard to follow. -->
    <section v-if="isPlatformAdmin" class="max-w-4xl space-y-4">
      <div class="flex flex-wrap items-center justify-between gap-4">
        <h2 class="text-lg font-semibold">
          {{ t('admin.users.heading') }}
        </h2>
        <div class="flex flex-wrap items-center gap-2">
          <form class="flex items-center gap-2" @submit.prevent="search()">
            <UInput v-model="searchTerm" icon="i-lucide-search" :placeholder="t('admin.users.search')" size="sm" />
            <UButton type="submit" size="sm" variant="subtle" :loading="pending">
              {{ t('admin.users.searchButton') }}
            </UButton>
          </form>
          <UButton size="sm" icon="i-lucide-user-plus" @click="() => { createOpen = true }">
            {{ t('admin.create.open') }}
          </UButton>
        </div>
      </div>

      <p v-if="inviteInfo" class="text-sm text-(--ui-text-muted)">
        {{ inviteInfo }}
      </p>

      <p v-if="statusError" class="text-sm text-red-600">
        {{ statusError }}
      </p>
      <p v-if="error" class="text-sm text-red-600">
        {{ t('admin.users.error', { msg: error.data?.statusMessage || error.statusMessage || error.message }) }}
      </p>

      <UTable
        v-else
        v-model:sorting="sorting"
        :data="accounts"
        :columns="columns"
        :loading="pending"
        :empty="t('admin.users.empty')"
        class="rounded-lg border border-(--ui-border) bg-white"
      >
        <template v-for="key in ['person', 'enabled']" :key="key" #[`${key}-header`]="{ column }">
          <UButton
            color="neutral"
            variant="ghost"
            size="xs"
            class="-mx-2 font-medium"
            :label="key === 'person' ? t('admin.users.person') : t('admin.users.status')"
            :trailing-icon="column.getIsSorted() === 'asc' ? 'i-lucide-arrow-up' : column.getIsSorted() === 'desc' ? 'i-lucide-arrow-down' : 'i-lucide-arrow-up-down'"
            @click="() => { column.toggleSorting(column.getIsSorted() === 'asc') }"
          />
        </template>

        <template #person-cell="{ row }">
          <div class="flex items-center gap-3">
            <UAvatar :text="initialsOf(row.original)" size="sm" />
            <div class="min-w-0">
              <p class="truncate font-medium text-(--ui-text-highlighted)">
                {{ displayName(row.original) }}
              </p>
              <p class="truncate text-xs text-(--ui-text-muted)">
                {{ row.original.username }}
              </p>
            </div>
          </div>
        </template>

        <template #email-cell="{ row }">
          <span class="text-(--ui-text-muted)">{{ row.original.email }}</span>
        </template>

        <template #roles-cell="{ row }">
          <div class="flex flex-wrap gap-1">
            <UBadge
              v-for="role in row.original.roles"
              :key="role"
              color="neutral"
              variant="outline"
              size="sm"
            >
              {{ t(`admin.roles.short.${role}`) }}
            </UBadge>
            <UBadge
              v-for="role in row.original.missing"
              :key="role"
              color="warning"
              variant="outline"
              size="sm"
            >
              {{ t('admin.roles.without', { role: t(`admin.roles.short.${role}`) }) }}
            </UBadge>
          </div>
        </template>

        <template #enabled-cell="{ row }">
          <UBadge :color="row.original.enabled ? 'success' : 'neutral'" variant="subtle" size="sm">
            {{ row.original.enabled ? t('admin.users.enabled') : t('admin.users.disabled') }}
          </UBadge>
        </template>

        <template #actions-cell="{ row }">
          <UDropdownMenu :items="actionsFor(row.original)" :content="{ align: 'end' }">
            <UButton
              icon="i-lucide-ellipsis-vertical"
              color="neutral"
              variant="ghost"
              size="sm"
              :loading="statusSaving === row.original.id"
              :aria-label="t('admin.users.actions', { name: row.original.username })"
            />
          </UDropdownMenu>
        </template>
      </UTable>

      <div v-if="total > PAGE_SIZE" class="flex flex-wrap items-center justify-between gap-2">
        <p class="text-sm text-(--ui-text-muted)">
          {{ t('admin.users.range', { from: (page - 1) * PAGE_SIZE + 1, to: Math.min(page * PAGE_SIZE, total), total }) }}
        </p>
        <UPagination v-model:page="page" :total="total" :items-per-page="PAGE_SIZE" size="sm" />
      </div>

      <UModal v-model:open="confirmOpen" :title="t('admin.users.disableTitle', { name: toDisable?.username ?? '' })">
        <template #body>
          <p class="text-sm">
            {{ t('admin.users.disableText', { name: toDisable?.username ?? '' }) }}
          </p>
        </template>
        <template #footer>
          <div class="flex w-full justify-end gap-2">
            <UButton variant="ghost" color="neutral" @click="() => { toDisable = null }">
              {{ t('admin.users.cancel') }}
            </UButton>
            <UButton
              color="error"
              icon="i-lucide-user-x"
              :loading="statusSaving !== null"
              @click="() => { if (toDisable) setEnabled(toDisable.id, false) }"
            >
              {{ t('admin.users.disable') }}
            </UButton>
          </div>
        </template>
      </UModal>

      <UModal v-model:open="createOpen" :title="t('admin.create.title')">
        <template #body>
          <AdminCreateAccount :key="createKey" @created="refresh()" />
        </template>
      </UModal>

      <UModal v-model:open="dialogOpen" :title="t('admin.roles.title', { name: rolesFor?.username ?? '' })">
        <template #body>
          <AdminPlatformRoles
            v-if="rolesFor"
            :key="rolesFor.id"
            :user-id="rolesFor.id"
            :username="rolesFor.username"
            :is-self="rolesFor.id === ownId"
          />
        </template>
      </UModal>
    </section>

    <p v-else class="text-(--ui-text-muted)">
      {{ t('common.comingSoon') }}
    </p>
  </div>
</template>
