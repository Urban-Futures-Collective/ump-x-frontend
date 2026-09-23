<script setup lang="ts">
// Hilfe: wie man die Plattform mit einer KI benutzt.
//
// Zwei Wege, und die Seite nennt beide gleichwertig: der Chat auf dieser Seite
// und der eigene KI-Client über MCP. Beide tragen genau die Rechte des
// Angemeldeten, keiner davon kommt an der Zugriffskontrolle vorbei.
//
// Die MCP-Adresse steht bewusst nur hier und nicht mehr auf der Startseite. Sie
// ist keine Webseite: im Browser geöffnet antwortet sie mit einer JSON-401, und
// wer das ohne Erklärung sieht, hält den Dienst für kaputt.
const { t } = useI18n()
const { mcpUrl } = useRuntimeConfig().public

const kopiert = ref(false)

async function kopieren() {
  try {
    await navigator.clipboard.writeText(mcpUrl)
    kopiert.value = true
    setTimeout(() => { kopiert.value = false }, 2000)
  }
  catch {
    // Ohne Zwischenablage-Recht bleibt die Adresse lesbar und markierbar,
    // das reicht. Eine Fehlermeldung dafür wäre lauter als der Nutzen.
  }
}

const chatSchritte = ['provider', 'key', 'ask'] as const
const mcpSchritte = ['address', 'signin', 'use'] as const
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
    </div>

    <div class="space-y-4">
      <h2 class="text-lg font-semibold text-(--ui-text-highlighted)">
        {{ t('help.chat.heading') }}
      </h2>
      <p class="text-sm text-(--ui-text-muted)">
        {{ t('help.chat.lead') }}
      </p>
      <ol class="space-y-4">
        <li v-for="(schritt, i) in chatSchritte" :key="schritt" class="flex gap-4">
          <span class="flex size-8 shrink-0 items-center justify-center rounded-full bg-ufc-blue-100 text-sm font-medium text-ufc-teal-600">
            {{ i + 1 }}
          </span>
          <span class="space-y-1">
            <span class="block font-medium text-(--ui-text-highlighted)">{{ t(`help.chat.steps.${schritt}.title`) }}</span>
            <span class="block text-sm text-(--ui-text-muted)">{{ t(`help.chat.steps.${schritt}.body`) }}</span>
          </span>
        </li>
      </ol>
    </div>

    <div class="space-y-4">
      <h2 class="text-lg font-semibold text-(--ui-text-highlighted)">
        {{ t('help.mcp.heading') }}
      </h2>
      <p class="text-sm text-(--ui-text-muted)">
        {{ t('help.mcp.lead') }}
      </p>
      <ol class="space-y-4">
        <li v-for="(schritt, i) in mcpSchritte" :key="schritt" class="flex gap-4">
          <span class="flex size-8 shrink-0 items-center justify-center rounded-full bg-ufc-blue-100 text-sm font-medium text-ufc-teal-600">
            {{ i + 1 }}
          </span>
          <span class="space-y-2">
            <span class="block font-medium text-(--ui-text-highlighted)">{{ t(`help.mcp.steps.${schritt}.title`) }}</span>
            <span class="block text-sm text-(--ui-text-muted)">{{ t(`help.mcp.steps.${schritt}.body`) }}</span>

            <!-- Kopierfeld statt Link: die Adresse gehört in ein anderes
                 Programm, nicht in die Adresszeile des Browsers. -->
            <span v-if="schritt === 'address'" class="flex w-full max-w-md items-center gap-2 rounded-lg border border-(--ui-border) bg-(--ui-bg) py-2 pe-2 ps-3">
              <code class="flex-1 truncate text-sm">{{ mcpUrl }}</code>
              <UButton
                :icon="kopiert ? 'i-lucide-check' : 'i-lucide-copy'"
                color="neutral"
                variant="ghost"
                size="xs"
                :aria-label="t('help.mcp.copy')"
                @click="kopieren"
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
