<script setup lang="ts">
import type { RegistryModel, RegistryServer } from '~/types/registry'

// Delete a model server for good (design A5.2 to A5.5), from the admin servers tab and
// from Contribute › My servers. UMP deletes the server with its models and their access
// requests and retires the name; Keycloak roles stay and have to be removed by hand.
// The button only unlocks once the exact name is typed.
const props = defineProps<{ server: RegistryServer | null, owner?: string }>()
const emit = defineEmits<{ close: [], stale: [name: string] }>()
const { t, locale } = useI18n()
const toast = useToast()
const { models, deleteServer, load } = useRegistry()
const { isPlatformAdmin } = useUmpRoles()

const onServer = computed(() => props.server ? modelsOfServer(props.server, models.value) : [])
const blocking = computed(() => blockingModels(onServer.value))
const titleOf = (m: RegistryModel) => inLang(m.fullName, locale.value, m.defaultLang) || m.remoteProcessId

const typed = ref('')
const busy = ref(false)
// Blocking models as UMP reported them on a 409, when our list was out of date.
const conflict = ref<{ slug: string, status: string }[] | null>(null)
watch(() => props.server, () => {
  typed.value = ''
  conflict.value = null
})

const matches = computed(() => !!props.server && typed.value === props.server.name)
const canDelete = computed(() => matches.value && !blocking.value.length && !conflict.value && !busy.value)

function statusOf(e: unknown): number | undefined {
  const err = e as { statusCode?: number, status?: number, response?: { status?: number } }
  return err.statusCode ?? err.status ?? err.response?.status
}
function detailOf(e: unknown): string {
  const data = (e as { data?: { detail?: unknown } }).data
  return typeof data?.detail === 'string' ? data.detail : apiErrorMessage(e)
}

async function confirm() {
  const s = props.server
  if (!s || !canDelete.value) return
  const removed = onServer.value.length
  busy.value = true
  try {
    await deleteServer(s.id)
    toast.add({
      title: t('registry.serverDelete.deleted', { name: s.name, n: removed }),
      description: t('registry.serverDelete.deletedRoles', { name: s.name }),
      color: 'success',
      duration: 10000,
      actions: isPlatformAdmin.value ? [{ label: t('registry.serverDelete.auditLink'), to: '/admin?tab=audit', variant: 'link' }] : undefined,
    })
    emit('close')
  }
  catch (e) {
    const status = statusOf(e)
    if (status === 409) {
      conflict.value = blockingFromDetail(detailOf(e))
      await load(true)
    }
    else if (status === 412) {
      emit('stale', s.name)
      emit('close')
    }
    else if (status === 404) {
      toast.add({ title: t('registry.serverDelete.gone', { name: s.name }), color: 'neutral' })
      await load(true)
      emit('close')
    }
    else {
      toast.add({ title: t('registry.serverDelete.failed'), description: apiErrorMessage(e), color: 'error' })
    }
  }
  finally {
    busy.value = false
  }
}
</script>

<template>
  <UModal
    :open="!!server"
    :title="server ? t('registry.serverDelete.title', { name: server.name }) : ''"
    :description="server ? [server.baseUrl, owner ? t('registry.serverDelete.owner', { name: owner }) : '', t('registry.contribute.serverModels', onServer.length)].filter(Boolean).join(' · ') : ''"
    @update:open="(v: boolean) => { if (!v) emit('close') }"
  >
    <template #body>
      <div v-if="server" class="space-y-4">
        <!-- Blocked: known from our list, or reported by UMP (409). -->
        <div v-if="blocking.length || conflict" class="space-y-2 rounded-lg border border-red-300 bg-red-50 p-4">
          <p class="font-medium text-red-700">
            {{ t('registry.serverDelete.blockedTitle') }}
          </p>
          <p class="text-sm text-red-700">
            {{ t('registry.serverDelete.blockedText') }}
          </p>
          <ul class="space-y-1 text-sm">
            <template v-if="conflict">
              <li v-for="b in conflict" :key="b.slug" class="flex flex-wrap items-center gap-2">
                <span class="font-medium">{{ b.slug }}</span>
                <UBadge color="neutral" variant="soft" size="sm">
                  {{ t(`registry.status.${b.status}`, b.status) }}
                </UBadge>
              </li>
            </template>
            <template v-else>
              <li v-for="m in blocking" :key="m.id" class="flex flex-wrap items-center gap-2">
                <span class="font-medium">{{ titleOf(m) }}</span>
                <UBadge color="neutral" variant="soft" size="sm">
                  {{ t(`registry.status.${m.status}`) }}
                </UBadge>
              </li>
            </template>
          </ul>
          <p v-if="conflict" class="text-xs text-(--ui-text-muted)">
            {{ t('registry.serverDelete.nothingDeleted') }}
          </p>
        </div>

        <template v-else>
          <p class="text-sm font-medium">
            {{ t('registry.serverDelete.undoable') }}
          </p>
          <ul class="list-disc space-y-1.5 pl-5 text-sm">
            <li>
              {{ onServer.length
                ? t('registry.serverDelete.models', { n: onServer.length, list: onServer.map(m => `${titleOf(m)} (${t(`registry.status.${m.status}`)})`).join(', ') })
                : t('registry.serverDelete.noModels') }}
            </li>
            <li>{{ t('registry.serverDelete.requests') }}</li>
            <li>{{ t('registry.serverDelete.retire', { name: server.name }) }}</li>
            <li>{{ t('registry.serverDelete.jobs') }}</li>
            <li class="text-amber-700">
              {{ t('registry.serverDelete.roles', { name: server.name }) }}
            </li>
            <li>{{ t('registry.serverDelete.audit') }}</li>
          </ul>
          <form id="delete-server" class="space-y-1" @submit.prevent="confirm">
            <label for="delete-server-name" class="text-sm">
              <i18n-t keypath="registry.serverDelete.type" tag="span">
                <template #name>
                  <span class="font-semibold text-red-700">{{ server.name }}</span>
                </template>
              </i18n-t>
            </label>
            <UInput
              id="delete-server-name"
              v-model="typed"
              autocomplete="off"
              spellcheck="false"
              :trailing-icon="matches ? 'i-lucide-check' : undefined"
              class="w-full"
              autofocus
            />
            <p class="text-xs text-(--ui-text-dimmed)">
              {{ t('registry.serverDelete.typeHint') }}
            </p>
          </form>
        </template>
      </div>
    </template>
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton color="neutral" variant="outline" @click="emit('close')">
          {{ blocking.length || conflict ? t('registry.serverDelete.close') : t('registry.serverDelete.cancel') }}
        </UButton>
        <UButton type="submit" form="delete-server" color="error" :disabled="!canDelete" :loading="busy">
          {{ t('registry.serverDelete.confirm') }}
        </UButton>
      </div>
    </template>
  </UModal>
</template>
