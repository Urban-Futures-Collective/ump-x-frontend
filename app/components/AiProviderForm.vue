<script setup lang="ts">
// Form for connecting the user's own language model.
//
// No separate settings page, since there is nothing else to configure. The form
// lives in the chat's empty state and behind the gear icon in its header.
//
// The three notices are always visible, not collapsible: our server not holding
// the key does not mean the key is safe in the browser, and users must know that
// before entering it.
import type { Access, Provider } from '~/composables/useAiProvider'

const emit = defineEmits<{ connected: [] }>()

const { t } = useI18n()
const { access, hasKey, setAccess, forget } = useAiProvider()

const provider = ref<Provider>(access.value.provider)
const model = ref(access.value.model)
const baseUrl = ref(access.value.baseUrl)
const apiKey = ref('')

const options = (['openrouter', 'openai', 'anthropic', 'kompatibel'] as const).map(value => ({
  label: t(`ai.providers.${value}`),
  value,
}))

// Only the generic compatible option needs a base URL; the known providers have fixed ones.
const customAddress = computed(() => provider.value === 'kompatibel')

watch(provider, (next) => {
  const preset = PROVIDER_DEFAULTS[next]
  baseUrl.value = preset.baseUrl
  if (!model.value || Object.values(PROVIDER_DEFAULTS).some(v => v.model === model.value)) {
    model.value = preset.model
  }
})

const ready = computed(() => apiKey.value.trim().length > 0 && model.value.trim().length > 0)

function submit() {
  if (!ready.value) return
  setAccess(
    { provider: provider.value, model: model.value.trim(), baseUrl: baseUrl.value.trim() } as Access,
    apiKey.value.trim(),
  )
  apiKey.value = ''
  emit('connected')
}
</script>

<template>
  <div class="flex h-full flex-col gap-5">
    <div class="space-y-3">
      <UIcon name="i-lucide-key-round" class="size-7 text-(--ui-primary)" />
      <h2 class="text-lg font-semibold text-(--ui-text-highlighted)">
        {{ t('ai.connect.heading') }}
      </h2>
      <p class="text-sm text-(--ui-text-muted)">
        {{ t('ai.connect.lead') }}
      </p>

      <!-- Usage is billed by the user's provider and we can neither predict nor cap
           it, so this warning comes before the input fields. -->
      <UAlert
        icon="i-lucide-flask-conical"
        color="warning"
        variant="subtle"
        :title="t('ai.experimental.title')"
        :description="t('ai.experimental.body')"
      />
    </div>

    <div class="space-y-4">
      <UFormField :label="t('ai.connect.provider')">
        <USelect v-model="provider" :items="options" value-key="value" class="w-full" />
      </UFormField>

      <UFormField v-if="customAddress" :label="t('ai.connect.baseUrl')">
        <UInput v-model="baseUrl" class="w-full" placeholder="http://localhost:8000/v1" />
      </UFormField>

      <UFormField :label="t('ai.connect.model')" :description="t('ai.connect.modelHint')">
        <UInput v-model="model" class="w-full" />
      </UFormField>

      <UFormField :label="t('ai.connect.key')">
        <UInput v-model="apiKey" type="password" class="w-full" placeholder="sk-..." @keyup.enter="submit" />
      </UFormField>

      <UButton block :disabled="!ready" @click="submit">
        {{ t('ai.connect.submit') }}
      </UButton>

      <UButton v-if="hasKey" block variant="ghost" color="neutral" icon="i-lucide-trash-2" @click="forget()">
        {{ t('ai.connect.forget') }}
      </UButton>
    </div>

    <div class="mt-auto space-y-3">
      <div class="space-y-2 text-xs text-(--ui-text-muted)">
        <p class="flex items-start gap-2">
          <UIcon name="i-lucide-triangle-alert" class="mt-0.5 size-3.5 shrink-0 text-(--ui-warning)" />
          <span>{{ t('ai.connect.warnKey') }}</span>
        </p>
        <p class="text-(--ui-text-dimmed)">
          {{ t('ai.connect.warnData') }}
        </p>
        <p class="text-(--ui-text-dimmed)">
          {{ t('ai.connect.warnScope') }}
        </p>
      </div>

      <USeparator />

      <div class="space-y-1 text-xs">
        <p class="text-(--ui-text-muted)">
          {{ t('ai.connect.mcp') }}
        </p>
        <ULink to="https://mcp.urbanfuturescollective.org/mcp" external target="_blank" class="text-(--ui-primary)">
          mcp.urbanfuturescollective.org
        </ULink>
      </div>
    </div>
  </div>
</template>
