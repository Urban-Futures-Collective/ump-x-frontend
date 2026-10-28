<script setup lang="ts">
import type { AuthType, DiscoveredProcess, RegistryServer } from '~/types/registry'

// New model (designs P2, P3): step 1 picks or registers the model server and connects,
// step 2 takes the chosen processes over as drafts. Step 3, the model card, is the
// model's own page. Connecting registers a new server first: the platform can only
// look at a server it knows (with sample data nothing is contacted).
definePageMeta({ middleware: ['auth', 'prototype', 'provider'] })
const { t } = useI18n()
const { myServers, discover, addServer, addModels, isLive } = useRegistry()

const step = ref<1 | 2>(1)
const steps = computed(() => [
  { n: 1, label: t('registry.new.steps.server') },
  { n: 2, label: t('registry.new.steps.processes') },
  { n: 3, label: t('registry.new.steps.card') },
])

const useExisting = ref(myServers.value.length > 0)
const serverId = ref(myServers.value[0]?.id ?? '')
const serverItems = computed(() => myServers.value.map(s => ({ label: `${s.name} (${s.baseUrl})`, value: s.id })))

const name = ref('')
const baseUrl = ref('')
const authType = ref<AuthType>('NoAuth')
const user = ref('')
const secret = ref('')
const keyName = ref('X-API-Key')
const authItems = computed(() => (['NoAuth', 'BasicAuth', 'ApiKey', 'BearerToken'] as AuthType[])
  .map(a => ({ label: t(`registry.auth.${a}`), value: a })))

// Same rule as the process id prefix in UMP: lower case, digits, dashes.
const nameValid = computed(() => /^[a-z0-9][a-z0-9-]{1,62}$/.test(name.value))
const urlValid = computed(() => /^https:\/\/\S+$/.test(baseUrl.value))
const serverReady = computed(() => useExisting.value ? !!serverId.value : nameValid.value && urlValid.value)
const serverName = computed(() => useExisting.value
  ? myServers.value.find(s => s.id === serverId.value)?.name ?? ''
  : name.value)

const server = ref<RegistryServer | null>(null)
const found = ref<DiscoveredProcess[]>([])
const picked = ref<string[]>([])
const discovering = ref(false)
const connected = ref(false)
const failure = ref<string | null>(null)
const creating = ref(false)
const selectable = computed(() => found.value.filter(p => !p.modelId))

async function connect() {
  discovering.value = true
  failure.value = null
  try {
    // Registered once: going back and connecting again reuses it.
    if (useExisting.value) {
      server.value = myServers.value.find(s => s.id === serverId.value) ?? null
    }
    else if (server.value?.name !== name.value || server.value.baseUrl !== baseUrl.value) {
      server.value = await addServer({ name: name.value, baseUrl: baseUrl.value, authType: authType.value, user: user.value, secret: secret.value, keyName: keyName.value })
    }
    if (!server.value) return
    found.value = await discover(server.value)
    picked.value = []
    connected.value = true
    step.value = 2
  }
  catch (e) {
    failure.value = apiErrorMessage(e)
  }
  finally {
    discovering.value = false
  }
}

function togglePick(id: string, on: boolean) {
  picked.value = on ? [...picked.value, id] : picked.value.filter(p => p !== id)
}

const toast = useToast()
async function create() {
  if (!server.value) return
  creating.value = true
  try {
    const ids = await addModels(server.value, found.value.filter(p => picked.value.includes(p.id)))
    await navigateTo(ids.length === 1 ? `/contribute/${ids[0]}` : '/contribute')
  }
  catch (e) {
    toast.add({ title: t('registry.failed'), description: apiErrorMessage(e), color: 'error' })
  }
  finally {
    creating.value = false
  }
}
</script>

<template>
  <section class="max-w-6xl space-y-6">
    <PrototypeNotice />

    <div class="space-y-3">
      <h1 class="text-2xl font-semibold text-ufc-slate-900">
        {{ t('registry.new.title') }}
      </h1>
      <ol class="flex flex-wrap items-center gap-2 text-sm" :aria-label="t('registry.new.title')">
        <li v-for="s in steps" :key="s.n" class="flex items-center gap-2" :aria-current="s.n === step ? 'step' : undefined">
          <span
            class="flex size-6 items-center justify-center rounded-full border text-xs"
            :class="s.n < step ? 'border-(--ui-success) text-(--ui-success)' : s.n === step ? 'border-(--ui-primary) bg-(--ui-primary) text-white' : 'border-(--ui-border-accented) text-(--ui-text-muted)'"
          >
            <UIcon v-if="s.n < step" name="i-lucide-check" class="size-3.5" aria-hidden="true" />
            <template v-else>{{ s.n }}</template>
          </span>
          <span :class="s.n === step ? 'font-medium text-(--ui-text-highlighted)' : 'text-(--ui-text-muted)'">{{ s.label }}</span>
          <UIcon v-if="s.n < 3" name="i-lucide-chevron-right" class="size-4 text-(--ui-primary)" aria-hidden="true" />
        </li>
      </ol>
    </div>

    <div class="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <!-- Step 1: where the model runs -->
      <UCard v-if="step === 1">
        <div class="space-y-5">
          <div class="space-y-1">
            <h2 class="text-lg font-semibold">
              {{ t('registry.new.where') }}
            </h2>
            <p class="text-sm text-(--ui-text-muted)">
              {{ t('registry.new.whereWhy') }}
            </p>
          </div>

          <fieldset class="grid gap-3 sm:grid-cols-2">
            <legend class="sr-only">
              {{ t('registry.new.where') }}
            </legend>
            <label
              v-for="choice in [true, false]"
              :key="String(choice)"
              class="flex cursor-pointer gap-3 rounded-lg border p-4 transition has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60"
              :class="useExisting === choice ? 'border-(--ui-primary) bg-(--ui-primary)/5' : 'border-(--ui-border)'"
            >
              <input
                v-model="useExisting"
                type="radio"
                name="server-choice"
                :value="choice"
                :disabled="choice && !myServers.length"
                class="mt-1 accent-(--ui-primary)"
              >
              <span class="space-y-0.5">
                <span class="block font-medium">{{ choice ? t('registry.new.existing') : t('registry.new.newServer') }}</span>
                <span class="block text-xs text-(--ui-text-muted)">
                  {{ choice ? (myServers.map(s => s.name).join(' · ') || t('registry.new.existingNone')) : t('registry.new.newServerHint') }}
                </span>
              </span>
            </label>
          </fieldset>

          <UFormField v-if="useExisting && myServers.length > 1" :label="t('registry.new.serverPick')">
            <USelect v-model="serverId" :items="serverItems" class="w-full" />
          </UFormField>

          <template v-if="!useExisting">
            <UFormField
              :label="t('registry.new.name')"
              :help="t('registry.new.nameHint', { example: `${name || 'osmnx-modelserver'}:street-permeability` })"
              :error="name && !nameValid ? t('registry.new.nameInvalid') : undefined"
              required
            >
              <UInput v-model="name" placeholder="osmnx-modelserver" class="w-full" />
            </UFormField>
            <UFormField
              :label="t('registry.new.url')"
              :help="t('registry.new.urlHint')"
              :error="baseUrl && !urlValid ? t('registry.new.urlInvalid') : undefined"
              required
            >
              <UInput v-model="baseUrl" type="url" placeholder="https://" class="w-full" />
            </UFormField>

            <h3 class="pt-2 font-semibold">
              {{ t('registry.new.login') }}
            </h3>
            <UFormField :label="t('registry.new.auth')">
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
            <div v-else-if="authType === 'ApiKey'" class="grid gap-4 sm:grid-cols-2">
              <UFormField :label="t('registry.new.keyName')">
                <UInput v-model="keyName" autocomplete="off" class="w-full" />
              </UFormField>
              <UFormField :label="t('registry.new.token')">
                <UInput v-model="secret" type="password" autocomplete="off" class="w-full" />
              </UFormField>
            </div>
            <UFormField v-else-if="authType === 'BearerToken'" :label="t('registry.new.token')">
              <UInput v-model="secret" type="password" autocomplete="off" class="w-full" />
            </UFormField>
            <p v-if="authType !== 'NoAuth'" class="text-xs text-(--ui-text-muted)">
              {{ t('registry.new.secretNote') }}<template v-if="!isLive"> {{ t('registry.new.secretPrototype') }}</template>
            </p>
          </template>

          <div class="flex flex-wrap justify-end gap-2 border-t border-(--ui-border) pt-4">
            <UButton color="neutral" variant="outline" to="/contribute">
              {{ t('registry.cancel') }}
            </UButton>
            <UButton :disabled="!serverReady" :loading="discovering" @click="connect">
              {{ t('registry.new.discover') }}
            </UButton>
          </div>
        </div>
      </UCard>

      <!-- Step 2: which processes become models -->
      <div v-else class="space-y-3">
        <div class="flex flex-wrap items-baseline justify-between gap-2">
          <h2 class="text-lg font-semibold">
            {{ t('registry.new.processesOn', { server: serverName }) }}
          </h2>
          <p class="text-sm text-(--ui-text-muted)">
            {{ t('registry.new.selected', { n: picked.length, m: selectable.length }) }}
          </p>
        </div>
        <fieldset class="space-y-2">
          <legend class="sr-only">
            {{ t('registry.new.processesOn', { server: serverName }) }}
          </legend>
          <label
            v-for="p in found"
            :key="p.id"
            class="flex gap-3 rounded-lg border bg-white p-4"
            :class="[
              picked.includes(p.id) ? 'border-(--ui-success)' : 'border-(--ui-border)',
              p.modelId ? 'opacity-60' : 'cursor-pointer',
            ]"
          >
            <UCheckbox
              :model-value="picked.includes(p.id)"
              :disabled="!!p.modelId"
              :aria-label="p.title || p.id"
              class="mt-0.5"
              @update:model-value="on => togglePick(p.id, !!on)"
            />
            <span class="min-w-0 flex-1 space-y-0.5">
              <span class="block font-medium">{{ p.title || p.id }}</span>
              <span v-if="p.description" class="block text-sm text-(--ui-text-muted)">{{ p.description }}</span>
              <span class="block text-xs text-(--ui-text-dimmed)">{{ serverName }}:{{ p.id }}</span>
            </span>
            <span class="flex shrink-0 flex-col items-end gap-1">
              <UBadge v-if="p.version" color="neutral" variant="outline" size="sm">v{{ p.version }}</UBadge>
              <UBadge v-if="p.modelId" color="info" variant="subtle" size="sm">{{ t('registry.new.already') }}</UBadge>
            </span>
          </label>
        </fieldset>
        <div class="flex flex-wrap justify-between gap-2 pt-1">
          <UButton color="neutral" variant="outline" @click="() => { step = 1 }">
            {{ t('registry.new.back') }}
          </UButton>
          <UButton :disabled="!picked.length" :loading="creating" @click="create">
            {{ t('registry.new.create', picked.length) }}
          </UButton>
        </div>
      </div>

      <aside class="space-y-3 rounded-lg bg-ufc-blue-50 p-5 text-sm text-(--ui-text-muted)">
        <template v-if="step === 1">
          <h2 class="text-base font-semibold text-(--ui-text-highlighted)">
            {{ t('registry.new.howTitle') }}
          </h2>
          <ol class="list-decimal space-y-2 pl-4">
            <li>{{ t('registry.new.how1') }}</li>
            <li>{{ t('registry.new.how2') }}</li>
            <li>{{ t('registry.new.how3') }}</li>
          </ol>
          <div class="space-y-1 border-t border-(--ui-border) pt-3">
            <h3 class="font-semibold text-(--ui-text-highlighted)">
              {{ t('registry.new.check') }}
            </h3>
            <p v-if="failure" class="text-(--ui-error)" role="alert">
              {{ failure }}
            </p>
            <p v-else-if="connected" class="text-(--ui-success)">
              ✓ {{ t('registry.new.checkOk', found.length) }}
            </p>
            <p class="text-xs">
              {{ t('registry.new.internalHosts') }}
            </p>
          </div>
        </template>
        <template v-else>
          <h2 class="text-base font-semibold text-(--ui-text-highlighted)">
            {{ t('registry.new.filledTitle') }}
          </h2>
          <p>{{ t('registry.new.filled1') }}</p>
          <p>{{ t('registry.new.filled2') }}</p>
          <p>{{ t('registry.new.filled3') }}</p>
        </template>
      </aside>
    </div>
  </section>
</template>
