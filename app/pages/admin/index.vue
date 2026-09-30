<script setup lang="ts">
// Administration. auth + admin-Middleware: nur mit einer Admin-Rolle erreichbar;
// Reihenfolge zählt (erst Session, dann Rolle). Die Middleware blendet nur aus,
// geschützt sind die Daten serverseitig in jeder Route unter server/api/admin/.
//
// Bisher nur der Bereich des platform admins und darin nur die Nutzerliste, lesend.
// Er prüft die Kette bis zu Keycloak, bevor etwas gebaut wird, das Rollen vergibt.
definePageMeta({ middleware: ['auth', 'admin'] })
const { t } = useI18n()
const { isPlatformAdmin } = useUmpRoles()
const { user } = useOidcAuth()
const eigeneId = computed(() => (user.value?.userInfo as { sub?: string } | undefined)?.sub ?? null)

// Das Konto, dessen Rollen gerade im Dialog offen sind.
const rollenFuer = ref<{ id: string, username: string } | null>(null)
const dialogOffen = computed({
  get: () => rollenFuer.value !== null,
  set: (offen) => { if (!offen) rollenFuer.value = null },
})

interface Konto {
  id: string
  username: string
  email: string | null
  firstName: string | null
  lastName: string | null
  enabled: boolean
}

const suche = ref('')
const { data: konten, pending, error, refresh } = await useFetch<Konto[]>('/api/admin/platform/users', {
  query: { search: suche },
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
          <UInput v-model="suche" icon="i-lucide-search" :placeholder="t('admin.users.search')" size="sm" />
          <UButton type="submit" size="sm" variant="subtle" :loading="pending">
            {{ t('admin.users.searchButton') }}
          </UButton>
        </form>
      </div>

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
          <tr v-for="k in konten" :key="k.id" class="border-t border-(--ui-border)">
            <td class="px-3 py-2">{{ k.username }}</td>
            <td class="px-3 py-2">{{ [k.firstName, k.lastName].filter(Boolean).join(' ') }}</td>
            <td class="px-3 py-2">{{ k.email }}</td>
            <td class="px-3 py-2">
              <UBadge :color="k.enabled ? 'success' : 'neutral'" variant="subtle" size="sm">
                {{ k.enabled ? t('admin.users.enabled') : t('admin.users.disabled') }}
              </UBadge>
            </td>
            <td class="px-3 py-2 text-right">
              <UButton size="xs" variant="ghost" icon="i-lucide-shield-check" @click="rollenFuer = { id: k.id, username: k.username }">
                {{ t('admin.users.roles') }}
              </UButton>
            </td>
          </tr>
          <tr v-if="!pending && !konten.length">
            <td colspan="5" class="px-3 py-4 text-(--ui-text-muted)">{{ t('admin.users.empty') }}</td>
          </tr>
        </tbody>
      </table>

      <UModal v-model:open="dialogOffen" :title="t('admin.roles.title', { name: rollenFuer?.username ?? '' })">
        <template #body>
          <AdminPlatformRoles
            v-if="rollenFuer"
            :key="rollenFuer.id"
            :user-id="rollenFuer.id"
            :username="rollenFuer.username"
            :is-self="rollenFuer.id === eigeneId"
          />
        </template>
      </UModal>
    </section>

    <p v-else class="text-(--ui-text-muted)">
      {{ t('common.comingSoon') }}
    </p>
  </div>
</template>
