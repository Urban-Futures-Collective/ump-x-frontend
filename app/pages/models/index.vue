<script setup lang="ts">
// Modell-Katalog: übernimmt die Prozessliste aus der bisherigen app.vue. Klick auf ein
// Modell führt zur Ausführung (/run?process=<id>). Rollen-Filter passiert serverseitig
// in UMP — das Frontend braucht die Rollen dafür nicht.
const { t } = useI18n()
const { loggedIn } = useOidcAuth()
const { data: processes, pending, error, refresh } = useUmpProcesses()
</script>

<template>
  <section class="mx-auto max-w-3xl space-y-4">
    <div class="flex items-center justify-between">
      <h1 class="text-xl font-semibold">
        {{ t('processes.title') }}
      </h1>
      <UButton
        icon="i-lucide-refresh-cw"
        color="neutral"
        variant="ghost"
        size="xs"
        :loading="pending"
        @click="refresh()"
      >
        {{ t('processes.refresh') }}
      </UButton>
    </div>

    <p v-if="!loggedIn" class="text-sm text-(--ui-text-muted)">
      {{ t('processes.anonymousHint') }}
    </p>
    <p v-if="error" class="text-sm text-red-600 dark:text-red-400">
      {{ t('processes.error') }}
    </p>

    <ul v-if="processes?.length" class="space-y-2">
      <li v-for="p in processes" :key="p.id">
        <ULink
          :to="{ path: '/run', query: { process: p.id } }"
          class="flex items-center justify-between gap-3 rounded-md border border-(--ui-border) px-4 py-3 transition-colors hover:bg-(--ui-bg-elevated)"
        >
          <span class="min-w-0">
            <span class="block font-medium">{{ p.title }}</span>
            <span v-if="p.description" class="block truncate text-sm text-(--ui-text-muted)">
              {{ p.description }}
            </span>
            <span class="block text-xs text-(--ui-text-muted)">{{ p.id }}</span>
          </span>
          <UIcon name="i-lucide-arrow-right" class="shrink-0 text-(--ui-text-muted)" />
        </ULink>
      </li>
    </ul>
    <p v-else-if="!pending" class="text-sm text-(--ui-text-muted)">
      {{ t('processes.empty') }}
    </p>
  </section>
</template>
