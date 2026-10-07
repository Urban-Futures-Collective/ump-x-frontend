<script setup lang="ts">
import type { AuthType } from '~/types/registry'

// New model: register (or pick) the model server, fetch its processes, take the chosen
// ones over as drafts. The model card is filled in afterwards, per model.
// Prototype: the server is not contacted; it "finds" sample processes.
definePageMeta({ middleware: ['auth', 'prototype', 'provider'] })
const { t } = useI18n()
const { myServers, discover, addServer, addModels } = useRegistryPrototype()

const NEW = '__new__'
const serverChoice = ref<string>(myServers.value[0]?.id ?? NEW)
const serverItems = computed(() => [
  ...myServers.value.map(s => ({ label: `${s.name} (${s.baseUrl})`, value: s.id })),
  { label: t('registry.new.newServer'), value: NEW },
])

const name = ref('')
const baseUrl = ref('')
const authType = ref<AuthType>('NoAuth')
const user = ref('')
const secret = ref('')
const authItems = computed(() => (['NoAuth', 'BasicAuth', 'ApiKey', 'BearerToken'] as AuthType[])
  .map(a => ({ label: t(`registry.auth.${a}`), value: a })))

// Same rule as the process id prefix in UMP: lower case, digits, dashes.
const nameValid = computed(() => /^[a-z0-9][a-z0-9-]{1,62}$/.test(name.value))
const urlValid = computed(() => /^https:\/\/\S+$/.test(baseUrl.value))
const serverReady = computed(() => serverChoice.value !== NEW || (nameValid.value && urlValid.value))

const found = ref<{ id: string, title: string, description: string }[]>([])
const picked = ref<string[]>([])
const discovering = ref(false)

async function fetchProcesses() {
  discovering.value = true
  found.value = await discover(baseUrl.value)
  picked.value = []
  discovering.value = false
}

function togglePick(id: string, on: boolean) {
  picked.value = on ? [...picked.value, id] : picked.value.filter(p => p !== id)
}

function create() {
  const server = serverChoice.value === NEW
    ? addServer(name.value, baseUrl.value, authType.value, authType.value !== 'NoAuth' && !!secret.value)
    : myServers.value.find(s => s.id === serverChoice.value)!
  const ids = addModels(server, found.value.filter(p => picked.value.includes(p.id)))
  navigateTo(ids.length === 1 ? `/contribute/${ids[0]}` : '/contribute')
}
</script>

<template>
  <section class="max-w-3xl space-y-6">
    <PrototypeNotice />

    <div class="space-y-1">
      <ULink to="/contribute" class="flex items-center gap-1 text-sm text-(--ui-text-muted) hover:text-(--ui-text)">
        <UIcon name="i-lucide-arrow-left" aria-hidden="true" />
        {{ t('registry.contribute.title') }}
      </ULink>
      <h1 class="text-2xl font-semibold text-ufc-slate-900">
        {{ t('registry.new.title') }}
      </h1>
    </div>

    <UCard>
      <template #header>
        <h2 class="font-semibold">
          1. {{ t('registry.new.server') }}
        </h2>
        <p class="text-sm text-(--ui-text-muted)">
          {{ t('registry.new.serverWhy') }}
        </p>
      </template>
      <div class="space-y-4">
        <UFormField :label="t('registry.new.serverPick')">
          <USelect v-model="serverChoice" :items="serverItems" class="w-full" />
        </UFormField>
        <template v-if="serverChoice === NEW">
          <UFormField :label="t('registry.new.name')" :hint="t('registry.new.nameHint')" :error="name && !nameValid ? t('registry.new.nameInvalid') : undefined" required>
            <UInput v-model="name" placeholder="modelserver-1" class="w-full" />
          </UFormField>
          <UFormField :label="t('registry.new.url')" :error="baseUrl && !urlValid ? t('registry.new.urlInvalid') : undefined" required>
            <UInput v-model="baseUrl" type="url" placeholder="https://" class="w-full" />
          </UFormField>
          <UFormField :label="t('registry.new.auth')" :description="t('registry.new.authWhy')">
            <USelect v-model="authType" :items="authItems" class="w-full" />
          </UFormField>
          <div v-if="authType === 'BasicAuth'" class="grid gap-4 sm:grid-cols-2">
            <UFormField :label="t('registry.new.user')">
              <UInput v-model="user" autocomplete="off" class="w-full" />
            </UFormField>
            <UFormField :label="t('registry.new.password')">
              <UInput v-model="secret" type="password" autocomplete="new-password" class="w-full" />
            </UFormField>
          </div>
          <UFormField v-else-if="authType !== 'NoAuth'" :label="t('registry.new.token')">
            <UInput v-model="secret" type="password" autocomplete="off" class="w-full" />
          </UFormField>
          <p class="text-xs text-(--ui-text-muted)">
            {{ t('registry.new.secretNote') }}
          </p>
        </template>
        <UButton icon="i-lucide-search" :disabled="!serverReady" :loading="discovering" @click="fetchProcesses">
          {{ t('registry.new.discover') }}
        </UButton>
      </div>
    </UCard>

    <UCard v-if="found.length">
      <template #header>
        <h2 class="font-semibold">
          2. {{ t('registry.new.processes') }}
        </h2>
        <p class="text-sm text-(--ui-text-muted)">
          {{ t('registry.new.processesWhy') }}
        </p>
      </template>
      <fieldset class="space-y-3">
        <legend class="sr-only">
          {{ t('registry.new.processes') }}
        </legend>
        <UCheckbox
          v-for="p in found"
          :key="p.id"
          :model-value="picked.includes(p.id)"
          :label="`${p.title} (${p.id})`"
          :description="p.description"
          @update:model-value="on => togglePick(p.id, !!on)"
        />
      </fieldset>
      <template #footer>
        <div class="flex flex-wrap items-center justify-between gap-2">
          <p class="text-xs text-(--ui-text-muted)">
            {{ t('registry.new.next') }}
          </p>
          <UButton icon="i-lucide-file-plus-2" :disabled="!picked.length" @click="create">
            {{ t('registry.new.create', { n: picked.length }) }}
          </UButton>
        </div>
      </template>
    </UCard>
  </section>
</template>
