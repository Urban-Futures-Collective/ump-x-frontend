<script setup lang="ts">
import type { AuthType, RegistryServer, RegistryServerPatch } from '~/types/registry'

// Edit one of the provider's model servers (PATCH /servers/{id}). The name cannot change:
// it is the prefix of every process id and access role. The stored login is never sent
// back; it is only replaced when the type changes or a new secret is entered.
const props = defineProps<{ server: RegistryServer | null }>()
const emit = defineEmits<{ close: [] }>()
const { t } = useI18n()
const toast = useToast()
const { updateServer, isLive } = useRegistry()

const baseUrl = ref('')
const authType = ref<AuthType>('NoAuth')
const user = ref('')
const secret = ref('')
const keyName = ref('X-API-Key')
const ttwMinutes = ref(25)
const isActive = ref(true)
watch(() => props.server, (s) => {
  if (!s) return
  baseUrl.value = s.baseUrl
  authType.value = s.authType
  user.value = ''
  secret.value = ''
  keyName.value = 'X-API-Key'
  ttwMinutes.value = Math.round((s.ttwSeconds ?? 1500) / 60)
  isActive.value = s.isActive ?? true
}, { immediate: true })

const authItems = computed(() => (['NoAuth', 'BasicAuth', 'ApiKey', 'BearerToken'] as AuthType[])
  .map(a => ({ label: t(`registry.auth.${a}`), value: a })))
const urlValid = computed(() => /^https:\/\/\S+$/.test(baseUrl.value))
// A new login is needed when the type changes to one with a secret, or a secret is typed.
const authChanged = computed(() => !!props.server && (authType.value !== props.server.authType || !!secret.value))
const needsSecret = computed(() => authChanged.value && authType.value !== 'NoAuth')
const valid = computed(() => urlValid.value && ttwMinutes.value > 0
  && (!needsSecret.value || (!!secret.value && (authType.value !== 'BasicAuth' || !!user.value))))

const busy = ref(false)
async function save() {
  const s = props.server
  if (!s || !valid.value) return
  const patch: RegistryServerPatch = {}
  if (baseUrl.value !== s.baseUrl) patch.baseUrl = baseUrl.value
  if (authChanged.value) {
    patch.auth = authType.value === 'NoAuth'
      ? null
      : { type: authType.value, user: user.value, secret: secret.value, keyName: keyName.value }
  }
  const ttw = ttwMinutes.value * 60
  if (ttw !== (s.ttwSeconds ?? 1500)) patch.ttwSeconds = ttw
  if (isActive.value !== (s.isActive ?? true)) patch.isActive = isActive.value
  busy.value = true
  try {
    if (Object.keys(patch).length) await updateServer(s.id, patch)
    toast.add({ title: t('registry.server.saved', { name: s.name }), color: 'success' })
    emit('close')
  }
  catch (e) {
    toast.add({ title: t('registry.failed'), description: apiErrorMessage(e), color: 'error' })
  }
  finally {
    busy.value = false
  }
}
</script>

<template>
  <UModal :open="!!server" :title="t('registry.server.editTitle', { name: server?.name ?? '' })" @update:open="(v: boolean) => { if (!v) emit('close') }">
    <template #body>
      <form id="edit-server" class="space-y-4" @submit.prevent="save">
        <p class="text-sm text-(--ui-text-muted)">
          {{ t('registry.server.nameFixed') }}
        </p>
        <UFormField :label="t('registry.new.url')" :error="baseUrl && !urlValid ? t('registry.server.urlHint') : undefined" required>
          <UInput v-model="baseUrl" type="url" autocomplete="off" class="w-full" />
        </UFormField>

        <UFormField :label="t('registry.new.auth')">
          <USelect v-model="authType" :items="authItems" class="w-full" />
        </UFormField>
        <div v-if="authType === 'BasicAuth'" class="grid gap-4 sm:grid-cols-2">
          <UFormField :label="t('registry.new.user')" :required="needsSecret">
            <UInput v-model="user" autocomplete="off" class="w-full" />
          </UFormField>
          <UFormField :label="t('registry.new.password')" :required="needsSecret">
            <UInput v-model="secret" type="password" autocomplete="new-password" class="w-full" />
          </UFormField>
        </div>
        <div v-else-if="authType === 'ApiKey'" class="grid gap-4 sm:grid-cols-2">
          <UFormField :label="t('registry.new.keyName')">
            <UInput v-model="keyName" autocomplete="off" class="w-full" />
          </UFormField>
          <UFormField :label="t('registry.new.token')" :required="needsSecret">
            <UInput v-model="secret" type="password" autocomplete="off" class="w-full" />
          </UFormField>
        </div>
        <UFormField v-else-if="authType === 'BearerToken'" :label="t('registry.new.token')" :required="needsSecret">
          <UInput v-model="secret" type="password" autocomplete="off" class="w-full" />
        </UFormField>
        <p v-if="authType !== 'NoAuth'" class="text-xs text-(--ui-text-muted)">
          {{ server && authType === server.authType && server.hasCredentials ? t('registry.server.keepLogin') : t('registry.new.secretNote') }}<template v-if="!isLive">
            {{ t('registry.new.secretPrototype') }}
          </template>
        </p>

        <UFormField :label="t('registry.server.ttw')" :description="t('registry.server.ttwHint')">
          <UInputNumber v-model="ttwMinutes" :min="1" class="w-32" />
        </UFormField>
        <USwitch v-model="isActive" :label="t('registry.server.active')" :description="t('registry.server.activeHint')" />
      </form>
    </template>
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton color="neutral" variant="ghost" @click="() => { emit('close') }">
          {{ t('registry.cancel') }}
        </UButton>
        <UButton type="submit" form="edit-server" :disabled="!valid" :loading="busy">
          {{ t('registry.server.save') }}
        </UButton>
      </div>
    </template>
  </UModal>
</template>
