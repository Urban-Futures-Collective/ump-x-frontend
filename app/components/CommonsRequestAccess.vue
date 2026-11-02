<script setup lang="ts">
import type { RegistryModel } from '~/types/registry'
import type { ApiAccessRequest } from '~/utils/accessRequest'

// "Request access" on a model page (design C1). The request goes to UMP with a purpose;
// an access admin decides in the access manager (A3). Without the registry there is
// nothing to send the request to, so the button stays disabled as before.
const props = defineProps<{ card?: RegistryModel }>()
const { t } = useI18n()
const toast = useToast()
const { registryApi, umpBase } = useRuntimeConfig().public
const { loggedIn, login } = useOidcAuth()
const { roles } = useUmpRoles()
const base = `${umpBase}/registry/v1`

const mySub = ref('')
const requests = ref<ApiAccessRequest[]>([])
const loaded = ref(false)

async function load() {
  const card = props.card
  if (!registryApi || !loggedIn.value || !card) return
  try {
    const [me, page] = await Promise.all([
      $fetch<{ sub: string }>(`${base}/me`),
      $fetch<{ requests: ApiAccessRequest[] }>(`${base}/access-requests`, { query: { model_id: card.id, limit: 50 } }),
    ])
    mySub.value = me.sub
    requests.value = page.requests
  }
  catch {
    // Without the list the button is still offered; UMP refuses a second open request.
    requests.value = []
  }
  finally {
    loaded.value = true
  }
}
onMounted(load)
watch(() => props.card?.id, load)

const state = computed(() => {
  if (!props.card) return { kind: 'none' as const }
  if (loggedIn.value && !loaded.value) return { kind: 'loading' as const }
  return accessState({ card: props.card, loggedIn: loggedIn.value, roles: roles.value, mySub: mySub.value, requests: requests.value })
})

const open = ref(false)
const purpose = ref('')
const sending = ref(false)

async function send() {
  if (!props.card || !purpose.value.trim()) return
  sending.value = true
  try {
    await $fetch(`${base}/models/${props.card.id}/access-requests`, { method: 'POST', body: { note: purpose.value.trim() } })
    open.value = false
    purpose.value = ''
    toast.add({ title: t('commons.access.sent'), color: 'success' })
    await load()
  }
  catch (e) {
    toast.add({ title: t('commons.access.failed'), description: apiErrorMessage(e), color: 'error' })
  }
  finally {
    sending.value = false
  }
}

async function withdraw(requestId: string) {
  try {
    await $fetch(`${base}/access-requests/${requestId}/transitions`, { method: 'POST', body: { to_status: 'withdrawn' } })
    await load()
  }
  catch (e) {
    toast.add({ title: t('commons.access.failed'), description: apiErrorMessage(e), color: 'error' })
  }
}
</script>

<template>
  <UButton v-if="!registryApi" color="neutral" variant="outline" size="lg" disabled>
    {{ t('auth.requestAccess') }}
  </UButton>
  <UButton v-else-if="state.kind === 'login'" color="neutral" variant="outline" size="lg" @click="login()">
    {{ t('auth.requestAccess') }}
  </UButton>
  <UButton v-else-if="state.kind === 'loading'" color="neutral" variant="outline" size="lg" loading disabled>
    {{ t('auth.requestAccess') }}
  </UButton>
  <template v-else-if="state.kind === 'request'">
    <UButton color="neutral" variant="outline" size="lg" @click="() => { open = true }">
      {{ t('auth.requestAccess') }}
    </UButton>
    <UModal v-model:open="open" :title="t('commons.access.title', { name: card?.fullName[card.defaultLang] || card?.remoteProcessId })">
      <template #body>
        <form id="access-request" class="space-y-4" @submit.prevent="send">
          <p v-if="state.denied !== undefined" class="rounded-lg bg-(--ui-bg-elevated) px-3 py-2 text-sm">
            {{ state.denied ? t('commons.access.deniedWith', { note: state.denied }) : t('commons.access.denied') }}
          </p>
          <p class="text-sm text-(--ui-text-muted)">
            {{ t('commons.access.intro') }}
          </p>
          <UFormField :label="t('commons.access.purpose')" required>
            <UTextarea v-model="purpose" :rows="3" :maxlength="4000" autoresize class="w-full" autofocus />
          </UFormField>
        </form>
      </template>
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton variant="ghost" color="neutral" @click="() => { open = false }">
            {{ t('commons.access.cancel') }}
          </UButton>
          <UButton type="submit" form="access-request" :loading="sending" :disabled="!purpose.trim()">
            {{ t('commons.access.send') }}
          </UButton>
        </div>
      </template>
    </UModal>
  </template>
  <div v-else-if="state.kind === 'pending'" class="flex items-center gap-2">
    <UButton color="neutral" variant="outline" size="lg" icon="i-lucide-hourglass" disabled>
      {{ t('commons.access.pending') }}
    </UButton>
    <UButton color="neutral" variant="link" @click="withdraw(state.requestId)">
      {{ t('commons.access.withdraw') }}
    </UButton>
  </div>
  <p v-else-if="state.kind === 'granted'" class="max-w-56 self-center text-sm text-(--ui-text-muted)">
    {{ t('commons.access.granted') }}
  </p>
</template>
