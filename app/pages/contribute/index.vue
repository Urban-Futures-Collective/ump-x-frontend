<script setup lang="ts">
// Contribute: the signed-in provider's models with their review status.
// Prototype with sample data (see useRegistryPrototype).
definePageMeta({ middleware: ['auth', 'prototype', 'provider'] })
const { t, locale } = useI18n()
const { myModels } = useRegistryPrototype()

const search = ref('')
const shown = computed(() => myModels.value.filter(m => matchesSearch(search.value,
  inLang(m.fullName, locale.value, m.defaultLang), inLang(m.shortDescription, locale.value, m.defaultLang), m.serverName, m.remoteProcessId)))
</script>

<template>
  <section class="max-w-5xl space-y-6">
    <PrototypeNotice />

    <div class="flex flex-wrap items-start justify-between gap-4">
      <div class="space-y-1">
        <h1 class="text-2xl font-semibold text-ufc-slate-900">
          {{ t('registry.contribute.title') }}
        </h1>
        <p class="text-sm text-(--ui-text-muted)">
          {{ t('registry.contribute.intro') }}
        </p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <UInput v-model="search" icon="i-lucide-search" :placeholder="t('registry.search')" :aria-label="t('registry.search')" size="sm" />
        <UButton icon="i-lucide-plus" size="sm" to="/contribute/new">
          {{ t('registry.contribute.new') }}
        </UButton>
      </div>
    </div>

    <h2 class="text-lg font-semibold">
      {{ t('registry.contribute.mine') }}
    </h2>
    <p v-if="!shown.length" class="text-sm text-(--ui-text-muted)">
      {{ search ? t('registry.noMatch') : t('registry.contribute.empty') }}
    </p>
    <ul v-else class="grid gap-4 md:grid-cols-2">
      <li v-for="m in shown" :key="m.id">
        <RegistryModelCard :model="m" :to="`/contribute/${m.id}`" />
      </li>
    </ul>
  </section>
</template>
