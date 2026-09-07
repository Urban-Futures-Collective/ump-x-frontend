<script setup lang="ts">
// Modell-Katalog: übernimmt die Prozessliste aus der bisherigen app.vue. Klick auf ein
// Modell führt zur Ausführung (/run?process=<id>). Rollen-Filter passiert serverseitig
// in UMP — das Frontend braucht die Rollen dafür nicht.
const { t } = useI18n()
const { loggedIn } = useOidcAuth()
const { data: processes, pending, error, refresh } = useUmpProcesses()

// Der Katalog zeigt seit 2026-09-04 wieder allen alles. Damit steht hier auch,
// was man nicht starten darf, und das gehört an die Zeile statt hinter den Klick.
const { data: ausfuehrbar } = useUmpRunnableProcesses()
const gesperrt = (id: string) => ausfuehrbar.value.length > 0 && !ausfuehrbar.value.includes(id)
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
    <p v-if="error" class="text-sm text-red-600">
      {{ t('processes.error', { msg: apiErrorMessage(error) }) }}
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
          <span class="flex shrink-0 items-center gap-2">
            <UBadge v-if="gesperrt(p.id)" color="neutral" variant="subtle" size="sm">
              {{ t('processes.locked') }}
            </UBadge>
            <UIcon name="i-lucide-arrow-right" class="text-(--ui-text-muted)" />
          </span>
        </ULink>
      </li>
    </ul>
    <p v-else-if="!pending" class="text-sm text-(--ui-text-muted)">
      {{ t('processes.empty') }}
    </p>
  </section>
</template>
