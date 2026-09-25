<script setup lang="ts">
// Commons: der Modell-Katalog nach dem Entwurf „Landing Screen“. Jedes Modell
// eine Kachel, ein Klick führt zur Ausführung (/run?process=<id>). Rollen-Filter
// passiert serverseitig in UMP, das Frontend braucht die Rollen dafür nicht.
const { t } = useI18n()
const { loggedIn } = useOidcAuth()
const { data: processes, pending, error } = useUmpProcesses()

// Dieselben drei Schritte wie auf der Startseite.
const schritte = ['choose', 'configure', 'take'] as const
</script>

<template>
  <div class="space-y-16">
    <section class="space-y-8">
      <div class="space-y-2">
        <h1 class="text-2xl font-semibold text-ufc-slate-900">
          {{ t('commons.title') }}
        </h1>
        <p v-if="!loggedIn" class="text-[0.9375rem] text-(--ui-text-muted)">
          {{ t('commons.anonymousHint') }}
        </p>
      </div>

      <!-- Eigene Commons gibt es noch nicht, weder im Backend noch als
           Datenhaltung. Der Knopf steht nach derselben Regel wie die geplanten
           Einträge in der Seitenleiste da: sichtbar, damit man sieht, wohin es
           geht, und ausgegraut, damit niemand ins Leere klickt. -->
      <div class="flex items-center gap-4">
        <UIcon name="i-lucide-folder-pen" class="size-9 text-ufc-blue-500" />
        <UButton icon="i-lucide-plus" class="rounded-full" disabled>
          {{ t('commons.new') }}
        </UButton>
      </div>

      <div class="space-y-4">
        <p class="text-[0.9375rem] text-(--ui-text)">
          {{ t('commons.lead') }}
        </p>

        <p v-if="error" class="text-sm text-red-600">
          {{ t('processes.error', { msg: apiErrorMessage(error) }) }}
        </p>

        <ul v-if="processes?.length" class="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
          <li v-for="p in processes" :key="p.id">
            <ModelCard
              :title="p.title"
              :description="p.description"
              :to="{ path: '/run', query: { process: p.id } }"
            />
          </li>
        </ul>
        <p v-else-if="!pending && !error" class="text-sm text-(--ui-text-muted)">
          {{ t('processes.empty') }}
        </p>
      </div>
    </section>

    <section class="space-y-4">
      <h2 class="text-2xl font-semibold text-ufc-slate-900">
        {{ t('commons.scenarios') }}
      </h2>
      <ol class="grid gap-6 md:grid-cols-3">
        <li
          v-for="(schritt, i) in schritte"
          :key="schritt"
          class="space-y-2.5 py-4 md:pr-6"
        >
          <span class="inline-block bg-ufc-teal-700 pl-1 pr-4 text-lg/7 font-semibold text-white">
            {{ i + 1 }}
          </span>
          <h3 class="font-medium text-(--ui-text)">
            {{ t(`start.steps.${schritt}.title`) }}
          </h3>
          <p class="text-sm text-(--ui-text-muted)">
            {{ t(`start.steps.${schritt}.body`) }}
          </p>
        </li>
      </ol>
    </section>
  </div>
</template>
