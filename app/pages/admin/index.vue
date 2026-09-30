<script setup lang="ts">
// Administration. auth + admin middleware: only reachable with an admin role; order
// matters (session first, then role). The middleware only hides UI; the data is protected
// server-side in every route under server/api/admin/.
//
// Currently only the platform admin section: list accounts, enable and disable them,
// assign platform roles. Creating accounts needs Keycloak to send email (password setup
// invitation).
definePageMeta({ middleware: ['auth', 'admin'] })
const { t } = useI18n()
const { isPlatformAdmin } = useUmpRoles()
const { user } = useOidcAuth()
const ownId = computed(() => (user.value?.userInfo as { sub?: string } | undefined)?.sub ?? null)

// The account whose roles are open in the dialog.
const rolesFor = ref<{ id: string, username: string } | null>(null)
const dialogOpen = computed({
  get: () => rolesFor.value !== null,
  set: (open) => { if (!open) rolesFor.value = null },
})

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
}

const searchTerm = ref('')
const { data: accounts, pending, error, refresh } = await useFetch<Account[]>('/api/admin/platform/users', {
  query: { search: searchTerm },
  immediate: isPlatformAdmin.value,
  watch: false,
  default: () => [],
})
</script>

<template>
  <div class="space-y-6">
    <h1 class="text-2xl font-semibold text-ufc-slate-900">
      {{ t('admin.title') }}
    </h1>

    <section v-if="isPlatformAdmin" class="space-y-4">
      <div class="flex flex-wrap items-center justify-between gap-4">
        <h2 class="text-lg font-semibold">
          {{ t('admin.users.heading') }}
        </h2>
        <form class="flex items-center gap-2" @submit.prevent="refresh()">
          <UInput v-model="searchTerm" icon="i-lucide-search" :placeholder="t('admin.users.search')" size="sm" />
          <UButton type="submit" size="sm" variant="subtle" :loading="pending">
            {{ t('admin.users.searchButton') }}
          </UButton>
        </form>
      </div>

      <p v-if="statusError" class="text-sm text-red-600">
        {{ statusError }}
      </p>
      <p v-if="error" class="text-sm text-red-600">
        {{ t('admin.users.error', { msg: error.data?.statusMessage || error.statusMessage || error.message }) }}
      </p>

      <table v-else class="w-full border border-(--ui-border) bg-white text-sm">
        <thead class="text-left text-(--ui-text-muted)">
          <tr>
            <th class="px-3 py-2 font-medium">{{ t('admin.users.username') }}</th>
            <th class="px-3 py-2 font-medium">{{ t('admin.users.name') }}</th>
            <th class="px-3 py-2 font-medium">{{ t('admin.users.email') }}</th>
            <th class="px-3 py-2 font-medium">{{ t('admin.users.status') }}</th>
            <th class="px-3 py-2" />
          </tr>
        </thead>
        <tbody>
          <tr v-for="k in accounts" :key="k.id" class="border-t border-(--ui-border)">
            <td class="px-3 py-2">{{ k.username }}</td>
            <td class="px-3 py-2">{{ [k.firstName, k.lastName].filter(Boolean).join(' ') }}</td>
            <td class="px-3 py-2">{{ k.email }}</td>
            <td class="px-3 py-2">
              <UBadge :color="k.enabled ? 'success' : 'neutral'" variant="subtle" size="sm">
                {{ k.enabled ? t('admin.users.enabled') : t('admin.users.disabled') }}
              </UBadge>
            </td>
            <td class="px-3 py-2 text-right whitespace-nowrap">
              <UButton size="xs" variant="ghost" icon="i-lucide-shield-check" @click="rolesFor = { id: k.id, username: k.username }">
                {{ t('admin.users.roles') }}
              </UButton>
              <UButton
                v-if="k.enabled"
                size="xs"
                variant="ghost"
                color="neutral"
                icon="i-lucide-user-x"
                :disabled="k.id === ownId || statusSaving !== null"
                :title="k.id === ownId ? t('admin.users.ownAccount') : undefined"
                @click="toDisable = { id: k.id, username: k.username }"
              >
                {{ t('admin.users.disable') }}
              </UButton>
              <UButton
                v-else
                size="xs"
                variant="ghost"
                icon="i-lucide-user-check"
                :loading="statusSaving === k.id"
                :disabled="statusSaving !== null"
                @click="setEnabled(k.id, true)"
              >
                {{ t('admin.users.enable') }}
              </UButton>
            </td>
          </tr>
          <tr v-if="!pending && !accounts.length">
            <td colspan="5" class="px-3 py-4 text-(--ui-text-muted)">{{ t('admin.users.empty') }}</td>
          </tr>
        </tbody>
      </table>

      <UModal v-model:open="confirmOpen" :title="t('admin.users.disableTitle', { name: toDisable?.username ?? '' })">
        <template #body>
          <p class="text-sm">
            {{ t('admin.users.disableText', { name: toDisable?.username ?? '' }) }}
          </p>
        </template>
        <template #footer>
          <div class="flex w-full justify-end gap-2">
            <UButton variant="ghost" color="neutral" @click="toDisable = null">
              {{ t('admin.users.cancel') }}
            </UButton>
            <UButton
              color="error"
              icon="i-lucide-user-x"
              :loading="statusSaving !== null"
              @click="toDisable && setEnabled(toDisable.id, false)"
            >
              {{ t('admin.users.disable') }}
            </UButton>
          </div>
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
