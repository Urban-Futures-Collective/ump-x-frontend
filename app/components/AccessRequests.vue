<script setup lang="ts">
import type { AccessRequestRow } from '~/utils/accessRequest'

// Access requests (design A3): people ask for a model on its page, access admins decide
// here. Approving maps the Keycloak role first (UMP has no write path to Keycloak) and
// then records "granted" in UMP; UMP mails the decision to the person.
// Search and filters live in the page head and its ListBar (as on every list page); the
// servers found here feed the server filter there.
const props = defineProps<{ search: string, filter: Record<string, string[]> }>()
const emit = defineEmits<{ pending: [n: number], changed: [], servers: [names: string[]] }>()
const { t, locale } = useI18n()
const toast = useToast()
const { umpBase } = useRuntimeConfig().public
const { isPlatformAdmin } = useUmpRoles()
const base = `${umpBase}/registry/v1`

const status = computed(() => props.filter.status?.[0] ?? 'all')

const rows = ref<AccessRequestRow[]>([])
const loading = ref(false)
const loadError = ref<unknown>(null)

async function load() {
  loading.value = true
  loadError.value = null
  try {
    const page = await $fetch<{ requests: AccessRequestRow[] }>(`${base}/access-requests`, {
      query: { status: status.value === 'all' ? undefined : status.value, limit: 200, lang: locale.value },
    })
    rows.value = page.requests
    if (status.value === 'requested') emit('pending', page.requests.length)
  }
  catch (e) {
    rows.value = []
    loadError.value = e
  }
  finally {
    loading.value = false
  }
}
watch(status, load, { immediate: true })
defineExpose({ load })

watch(rows, list => emit('servers', [...new Set(list.map(r => serverOf(r)))].sort()))
const shown = computed(() => rows.value
  .filter(r => !props.filter.server?.length || props.filter.server.includes(serverOf(r)))
  .filter(r => matchesSearch(props.search, r.user.display_name ?? '', r.user.email ?? '', r.model.full_name ?? '', r.role)))

const nameOf = (r: AccessRequestRow) => r.user.display_name || r.user.email || r.user.sub
const date = (iso?: string | null) => iso ? new Date(iso).toLocaleDateString(locale.value, { dateStyle: 'medium' }) : ''

const busy = ref<string | null>(null)

async function approve(r: AccessRequestRow) {
  busy.value = r.id
  try {
    // Role first: if UMP then refuses, the person has access without a record, which the
    // models tab shows and can undo; the other way round UMP would claim a grant that
    // does not exist.
    await $fetch('/api/access/grants', { method: 'POST', body: { role: r.role, userId: r.user.sub } })
    await $fetch(`${base}/access-requests/${r.id}/transitions`, { method: 'POST', body: { to_status: 'granted' } })
    toast.add({ title: t('access.requests.approved', { name: nameOf(r) }), color: 'success' })
    await load()
    emit('changed')
  }
  catch (e) {
    toast.add({ title: t('access.failed'), description: apiErrorMessage(e), color: 'error' })
  }
  finally {
    busy.value = null
  }
}

// Denying needs a reason (UMP requires it); the person sees it on the model page and in
// the mail.
const denying = ref<AccessRequestRow | null>(null)
const reason = ref('')
async function deny() {
  const r = denying.value
  if (!r || !reason.value.trim()) return
  busy.value = r.id
  try {
    await $fetch(`${base}/access-requests/${r.id}/transitions`, { method: 'POST', body: { to_status: 'denied', note: reason.value.trim() } })
    denying.value = null
    reason.value = ''
    await load()
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
  <div class="space-y-6">
    <UAlert v-if="loadError" color="error" variant="subtle" icon="i-lucide-circle-alert" :title="t('access.loadFailed')" :description="apiErrorMessage(loadError)" />

    <div v-else class="overflow-x-auto rounded-lg bg-white">
      <p v-if="!loading && !shown.length" class="p-6 text-sm text-(--ui-text-muted)">
        {{ t('access.requests.empty') }}
      </p>
      <table v-else class="w-full text-left text-sm">
        <thead class="text-xs text-(--ui-text-muted)">
          <tr>
            <th scope="col" class="px-6 py-3 font-medium">
              {{ t('access.col.user') }}
            </th>
            <th scope="col" class="px-6 py-3 font-medium">
              {{ t('access.requests.col.access') }}
            </th>
            <th scope="col" class="px-6 py-3 font-medium">
              {{ t('access.requests.col.for') }}
            </th>
            <th scope="col" class="px-6 py-3 font-medium">
              {{ t('access.requests.col.purpose') }}
            </th>
            <th scope="col" class="px-6 py-3 font-medium">
              {{ t('access.requests.col.requested') }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in shown" :key="r.id" class="border-t border-(--ui-border) align-middle">
            <td class="px-6 py-4">
              <div class="flex items-center gap-3">
                <UAvatar :alt="nameOf(r)" size="sm" />
                <div class="min-w-0">
                  <p class="font-medium">
                    {{ nameOf(r) }}
                  </p>
                  <p v-if="r.user.email" class="text-xs text-(--ui-text-muted)">
                    {{ r.user.email }}
                  </p>
                </div>
              </div>
            </td>
            <td class="px-6 py-4">
              <p class="font-medium">
                {{ r.model.full_name || r.model.process_id }}
              </p>
              <p class="text-xs break-all text-(--ui-text-muted)">
                {{ r.role }}
              </p>
            </td>
            <td class="px-6 py-4">
              <UBadge color="info" variant="soft" size="sm">
                {{ t('access.requests.model') }}
              </UBadge>
            </td>
            <td class="max-w-xs px-6 py-4">
              {{ r.request_note }}
            </td>
            <td class="px-6 py-4">
              <div v-if="r.status === 'requested'" class="flex items-center gap-2">
                <UButton :loading="busy === r.id" :disabled="!!busy" @click="approve(r)">
                  {{ t('access.requests.approve') }}
                </UButton>
                <UButton color="neutral" variant="outline" :disabled="!!busy" @click="() => { denying = r; reason = '' }">
                  {{ t('access.requests.deny') }}
                </UButton>
              </div>
              <div v-else class="space-y-1">
                <UBadge :color="r.status === 'granted' ? 'success' : 'neutral'" variant="soft" size="sm">
                  {{ t(`access.requests.status.${r.status}`) }}
                </UBadge>
                <p class="text-xs text-(--ui-text-muted)">
                  {{ date(r.status_changed_at ?? r.created_at) }}
                </p>
              </div>
              <p v-if="r.status === 'requested'" class="mt-1 text-xs text-(--ui-text-muted)">
                {{ date(r.created_at) }}
              </p>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-ufc-gold-500 bg-ufc-gold-50 p-6">
      <div class="max-w-3xl space-y-2">
        <UBadge color="warning" variant="soft" size="sm">
          {{ t('access.requests.noteTitle') }}
        </UBadge>
        <p class="text-sm">
          {{ t('access.requests.note') }}
        </p>
      </div>
      <UButton v-if="isPlatformAdmin" color="neutral" variant="outline" to="/admin?tab=audit">
        {{ t('access.requests.auditLog') }}
      </UButton>
    </div>

    <UModal :open="!!denying" :title="t('access.requests.denyTitle', { name: denying ? nameOf(denying) : '' })" @update:open="(v: boolean) => { if (!v) denying = null }">
      <template #body>
        <form id="deny-request" class="space-y-4" @submit.prevent="deny">
          <p class="text-sm text-(--ui-text-muted)">
            {{ t('access.requests.denyIntro') }}
          </p>
          <UFormField :label="t('access.requests.reason')" required>
            <UTextarea v-model="reason" :rows="3" :maxlength="4000" autoresize class="w-full" autofocus />
          </UFormField>
        </form>
      </template>
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton color="neutral" variant="ghost" @click="() => { denying = null }">
            {{ t('access.requests.cancel') }}
          </UButton>
          <UButton type="submit" form="deny-request" :disabled="!reason.trim()" :loading="!!denying && busy === denying.id">
            {{ t('access.requests.deny') }}
          </UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>
