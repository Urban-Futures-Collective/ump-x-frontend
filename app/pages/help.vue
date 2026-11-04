<script setup lang="ts">
// Help: how to run a scenario, and how to use the platform with an AI.
//
// Scenarios come first: most visitors use the form, not a chat. For the AI there are
// two equal routes: the chat on this site and the user's own AI client via MCP.
// Both carry exactly the signed-in user's permissions; neither bypasses access
// control.
//
// The MCP address appears only here because it is not a web page: opened in a
// browser it answers with a JSON 401, which looks broken without explanation.
const { t, tm, rt } = useI18n()
const { mcpUrl } = useRuntimeConfig().public

const copied = ref(false)

async function copy() {
  try {
    await navigator.clipboard.writeText(mcpUrl)
    copied.value = true
    setTimeout(() => { copied.value = false }, 2000)
  }
  catch {
    // Without clipboard permission the address stays readable and selectable,
    // which is enough; an error message would be louder than it is useful.
  }
}

const sections = ['find', 'form', 'map', 'wait', 'result', 'failed'] as const
const points = (section: string) => (tm(`help.scenarios.sections.${section}.points`) as unknown[]).map(p => rt(p as never))
const nav = ['scenarios', 'chat', 'mcp'] as const

const chatSteps = ['provider', 'key', 'ask'] as const
const mcpSteps = ['address', 'signin', 'use'] as const
</script>

<template>
  <section class="mx-auto max-w-3xl space-y-10">
    <div class="space-y-3">
      <h1 class="text-2xl font-semibold text-(--ui-text-highlighted)">
        {{ t('help.title') }}
      </h1>
      <p class="text-(--ui-text-muted)">
        {{ t('help.lead') }}
      </p>
      <nav :aria-label="t('help.title')">
        <ul class="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <li v-for="id in nav" :key="id">
            <a :href="`#${id}`" class="text-(--ui-primary) underline-offset-2 hover:underline">{{ t(`help.nav.${id}`) }}</a>
          </li>
        </ul>
      </nav>
    </div>

    <div id="scenarios" class="scroll-mt-20 space-y-6">
      <div class="space-y-2">
        <h2 class="text-lg font-semibold text-(--ui-text-highlighted)">
          {{ t('help.scenarios.heading') }}
        </h2>
        <p class="text-sm text-(--ui-text-muted)">
          {{ t('help.scenarios.lead') }}
        </p>
      </div>
      <div v-for="(section, i) in sections" :key="section" class="flex gap-4">
        <span class="flex size-8 shrink-0 items-center justify-center rounded-full bg-ufc-blue-100 text-sm font-medium text-ufc-teal-600">
          {{ i + 1 }}
        </span>
        <div class="space-y-1">
          <h3 class="font-medium text-(--ui-text-highlighted)">
            {{ t(`help.scenarios.sections.${section}.title`) }}
          </h3>
          <ul class="list-disc space-y-1 ps-4 text-sm text-(--ui-text-muted)">
            <li v-for="p in points(section)" :key="p">
              {{ p }}
            </li>
          </ul>
        </div>
      </div>
    </div>

    <p class="text-sm text-(--ui-text-muted)">
      {{ t('help.aiLead') }}
    </p>

    <div id="chat" class="scroll-mt-20 space-y-4">
      <h2 class="text-lg font-semibold text-(--ui-text-highlighted)">
        {{ t('help.chat.heading') }}
      </h2>
      <p class="text-sm text-(--ui-text-muted)">
        {{ t('help.chat.lead') }}
      </p>
      <ol class="space-y-4">
        <li v-for="(step, i) in chatSteps" :key="step" class="flex gap-4">
          <span class="flex size-8 shrink-0 items-center justify-center rounded-full bg-ufc-blue-100 text-sm font-medium text-ufc-teal-600">
            {{ i + 1 }}
          </span>
          <span class="space-y-1">
            <span class="block font-medium text-(--ui-text-highlighted)">{{ t(`help.chat.steps.${step}.title`) }}</span>
            <span class="block text-sm text-(--ui-text-muted)">{{ t(`help.chat.steps.${step}.body`) }}</span>
          </span>
        </li>
      </ol>
    </div>

    <div id="mcp" class="scroll-mt-20 space-y-4">
      <h2 class="text-lg font-semibold text-(--ui-text-highlighted)">
        {{ t('help.mcp.heading') }}
      </h2>
      <p class="text-sm text-(--ui-text-muted)">
        {{ t('help.mcp.lead') }}
      </p>
      <ol class="space-y-4">
        <li v-for="(step, i) in mcpSteps" :key="step" class="flex gap-4">
          <span class="flex size-8 shrink-0 items-center justify-center rounded-full bg-ufc-blue-100 text-sm font-medium text-ufc-teal-600">
            {{ i + 1 }}
          </span>
          <span class="space-y-2">
            <span class="block font-medium text-(--ui-text-highlighted)">{{ t(`help.mcp.steps.${step}.title`) }}</span>
            <span class="block text-sm text-(--ui-text-muted)">{{ t(`help.mcp.steps.${step}.body`) }}</span>

            <!-- Copy field instead of a link: the address belongs in another
                 program, not in the browser's address bar. -->
            <span v-if="step === 'address'" class="flex w-full max-w-md items-center gap-2 rounded-lg border border-(--ui-border) bg-(--ui-bg) py-2 pe-2 ps-3">
              <code class="flex-1 truncate text-sm">{{ mcpUrl }}</code>
              <UButton
                :icon="copied ? 'i-lucide-check' : 'i-lucide-copy'"
                color="neutral"
                variant="ghost"
                size="xs"
                :aria-label="t('help.mcp.copy')"
                @click="copy"
              />
            </span>
          </span>
        </li>
      </ol>

      <div class="flex gap-3 rounded-lg bg-ufc-blue-50 p-4">
        <UIcon name="i-lucide-triangle-alert" class="mt-0.5 size-4 shrink-0 text-(--ui-text-muted)" />
        <p class="text-sm text-(--ui-text-muted)">
          {{ t('help.mcp.notAWebsite') }}
        </p>
      </div>
    </div>
  </section>
</template>
