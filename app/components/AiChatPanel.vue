<script setup lang="ts">
// The chat itself. Placement-agnostic, so it can be mounted in the app drawer or
// on the landing page.
import type { UIMessage } from 'ai'
import type { Message } from '~/composables/useAiChat'

// A question typed on the landing page. Without a key it is not lost but kept in
// the input field until the provider is set up.
const props = defineProps<{ initialQuestion?: string }>()
const emit = defineEmits<{ close: [] }>()

const { t } = useI18n()
const { loggedIn, login } = useOidcAuth()
const { access, hasKey } = useAiProvider()
const { messages, status, error, running, send, cancel, clear } = useAiChat()
// UChatMessages is typed for AI SDK messages. It only renders text and files
// itself; our tool parts are rendered through the content slot below.
const chatMessages = computed(() => messages.value as unknown as UIMessage[])

const input = ref('')
const accessOpen = ref(false)

// History survives closing and reloading, so one click could wipe a long
// conversation. Hence a confirmation that cannot be permanently dismissed.
const clearOpen = ref(false)

function clearHistory() {
  clear()
  clearOpen.value = false
}

// No key entry while signed out: the key costs the user money, so we require a
// known account first.
const showsForm = computed(() => loggedIn.value && (!hasKey.value || accessOpen.value))

const examples = computed(() => [t('ai.examples.what'), t('ai.examples.how')])

async function submit() {
  const text = input.value
  input.value = ''
  await send(text)
}

function pickExample(question: string) {
  input.value = question
  submit()
}

onMounted(() => {
  const question = props.initialQuestion?.trim()
  if (!question) return
  if (hasKey.value) pickExample(question)
  else input.value = question
})
</script>

<template>
  <div class="flex h-full flex-col bg-(--ui-bg)">
    <!-- Header: title left, actions right. -->
    <div class="flex items-center gap-2 border-b border-(--ui-border) px-5 py-3">
      <UIcon name="i-lucide-sparkles" class="size-4.5 text-(--ui-primary)" />
      <span class="text-sm font-medium text-(--ui-text-highlighted)">{{ t('ai.title') }}</span>
      <div class="ms-auto flex items-center gap-1">
        <!-- Labelled, not icon-only: a plus icon would suggest "new parallel
             chat", but there is only one conversation and this discards it. -->
        <UButton
          v-if="loggedIn && hasKey && messages.length"
          icon="i-lucide-trash-2"
          color="neutral"
          variant="ghost"
          size="xs"
          @click="() => { clearOpen = true }"
        >
          {{ t('ai.clear') }}
        </UButton>
        <UButton
          v-if="loggedIn && hasKey"
          icon="i-lucide-settings"
          color="neutral"
          variant="ghost"
          size="xs"
          :aria-label="t('ai.settings')"
          @click="() => { accessOpen = !accessOpen }"
        />
        <UButton
          icon="i-lucide-x"
          color="neutral"
          variant="ghost"
          size="xs"
          :aria-label="t('ai.close')"
          @click="emit('close')"
        />
      </div>
    </div>

    <!-- Signed out: stop here. -->
    <div v-if="!loggedIn" class="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
      <UIcon name="i-lucide-log-in" class="size-8 text-(--ui-text-muted)" />
      <h2 class="text-lg font-semibold text-(--ui-text-highlighted)">
        {{ t('ai.signIn.title') }}
      </h2>
      <p class="text-sm text-(--ui-text-muted)">
        {{ t('ai.signIn.body') }}
      </p>
      <UButton icon="i-lucide-log-in" color="primary" @click="login()">
        {{ t('auth.login') }}
      </UButton>
    </div>

    <!-- No key yet (or settings opened): show the provider form. -->
    <div v-else-if="showsForm" class="flex-1 overflow-y-auto p-5">
      <AiProviderForm @connected="accessOpen = false" />
    </div>

    <template v-else>
      <div class="flex flex-1 flex-col overflow-y-auto px-5 py-4">
        <div v-if="!messages.length" class="flex flex-1 flex-col justify-center gap-2 text-center">
          <UIcon name="i-lucide-sparkles" class="mx-auto size-8 text-(--ui-primary)" />
          <h2 class="text-lg font-semibold text-(--ui-text-highlighted)">
            {{ t('ai.title') }}
          </h2>
          <p class="text-sm text-(--ui-text-muted)">
            {{ t('ai.empty.lead') }}
          </p>
          <p class="text-xs text-(--ui-text-dimmed)">
            {{ t('ai.empty.connected', { provider: t(`ai.providers.${access.provider}`), model: access.model }) }}
          </p>
        </div>

        <!-- Custom content slot: our messages also contain tool parts, while
             UChatMessage only renders text and files by itself. -->
        <UChatMessages
          v-else
          :messages="chatMessages"
          :status="status"
          should-auto-scroll
          :assistant="{ side: 'left', variant: 'naked' }"
          :user="{ side: 'right', variant: 'soft' }"
        >
          <template #content="{ message }">
            <div class="space-y-2">
              <template v-for="(part, i) in (message as Message).parts" :key="i">
                <AiToolCard v-if="part.type === 'tool'" :part="part" @opened="emit('close')" />
                <p v-else-if="part.text" class="whitespace-pre-wrap">
                  {{ part.text }}
                </p>
              </template>
            </div>
          </template>
        </UChatMessages>

        <p v-if="running && messages.length" class="mt-2 text-xs text-(--ui-text-dimmed)">
          {{ t('ai.streaming') }}
        </p>
      </div>

      <div class="space-y-3 px-5 pb-4">
        <!-- Example questions only in the empty state. -->
        <div v-if="!messages.length" class="flex flex-col items-end gap-2">
          <UButton
            v-for="question in examples"
            :key="question"
            variant="outline"
            color="neutral"
            size="xs"
            @click="pickExample(question)"
          >
            {{ question }}
          </UButton>
        </div>

        <UAlert
          v-if="error"
          color="error"
          variant="subtle"
          icon="i-lucide-triangle-alert"
          :description="t('ai.error', { msg: error })"
        />

        <UChatPrompt
          v-model="input"
          :placeholder="t('ai.placeholder')"
          @submit="submit"
        >
          <UChatPromptSubmit :status="status" @stop="cancel()" />
        </UChatPrompt>

        <p class="text-xs text-(--ui-text-dimmed)">
          {{ t('ai.disclaimer') }}
        </p>
      </div>
    </template>
    <UModal
      v-model:open="clearOpen"
      :title="t('ai.clearConfirm.title')"
      :description="t('ai.clearConfirm.body')"
    >
      <template #footer>
        <UButton color="neutral" variant="ghost" @click="() => { clearOpen = false }">
          {{ t('ai.clearConfirm.cancel') }}
        </UButton>
        <UButton color="error" @click="clearHistory()">
          {{ t('ai.clearConfirm.confirm') }}
        </UButton>
      </template>
    </UModal>
  </div>
</template>
