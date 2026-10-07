<script setup lang="ts">
import type { RegistryModel } from '~/types/registry'

// One model in the registry lists (Contribute, Verify): name, description, process id,
// status and when the status last changed.
const props = defineProps<{ model: RegistryModel, to: string, showOwner?: boolean }>()
const { t, locale } = useI18n()
const { ownerLabel } = useRegistryPrototype()

const title = computed(() => inLang(props.model.fullName, locale.value, props.model.defaultLang) || props.model.remoteProcessId)
const description = computed(() => inLang(props.model.shortDescription, locale.value, props.model.defaultLang))
const changed = computed(() => new Date(props.model.statusChangedAt).toLocaleDateString(locale.value))
</script>

<template>
  <NuxtLink
    :to="to"
    class="group block rounded-lg border border-(--ui-border) bg-white p-4 transition hover:border-(--ui-primary) focus-visible:outline-2 focus-visible:outline-(--ui-primary)"
  >
    <div class="flex items-start justify-between gap-3">
      <div class="min-w-0 space-y-1">
        <p class="font-semibold text-(--ui-text-highlighted)">
          {{ title }}
        </p>
        <p v-if="description" class="line-clamp-2 text-sm text-(--ui-text-muted)">
          {{ description }}
        </p>
        <p class="text-xs text-(--ui-text-muted)">
          {{ model.serverName }}:{{ model.remoteProcessId }}
        </p>
      </div>
      <UIcon name="i-lucide-arrow-right" class="mt-1 size-4 shrink-0 text-(--ui-text-muted) group-hover:text-(--ui-primary)" aria-hidden="true" />
    </div>
    <div class="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-(--ui-text-muted)">
      <span>
        {{ t('registry.changedOn', { date: changed }) }}
        <template v-if="showOwner"> · {{ t('registry.by', { name: ownerLabel(model) }) }}</template>
      </span>
      <RegistryStatusBadge :status="model.status" />
    </div>
  </NuxtLink>
</template>
