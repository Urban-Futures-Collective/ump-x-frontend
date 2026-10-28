<script setup lang="ts">
import type { RegistryModel } from '~/types/registry'

// One model in the registry lists (Contribute, Verify), as in design P1: name,
// description, the reviewer's note where the owner has to act, process id; status
// on the right. As a tile the status moves below the text.
const props = defineProps<{ model: RegistryModel, to: string, showOwner?: boolean, tile?: boolean }>()
const { t, locale } = useI18n()
const { ownerLabel } = useRegistryPrototype()

const title = computed(() => inLang(props.model.fullName, locale.value, props.model.defaultLang) || props.model.remoteProcessId)
const description = computed(() => inLang(props.model.shortDescription, locale.value, props.model.defaultLang))
const changed = computed(() => new Date(props.model.statusChangedAt).toLocaleDateString(locale.value, { day: 'numeric', month: 'short', year: 'numeric' }))
// The note matters to the owner while they can still act on it.
const note = computed(() => ['changes_requested', 'rejected'].includes(props.model.status) ? props.model.statusNote : undefined)
</script>

<template>
  <NuxtLink
    :to="to"
    class="flex h-full flex-col gap-3 rounded-lg border border-(--ui-border) bg-white p-4 transition hover:border-(--ui-primary) focus-visible:outline-2 focus-visible:outline-(--ui-primary)"
    :class="tile ? '' : 'sm:flex-row sm:items-center sm:justify-between sm:gap-6'"
  >
    <div class="min-w-0 space-y-1">
      <p class="font-semibold text-(--ui-text-highlighted)">
        {{ title }}
      </p>
      <p v-if="description" class="line-clamp-2 text-sm text-(--ui-text-muted)">
        {{ description }}
      </p>
      <p v-if="note" class="text-sm text-(--ui-warning)">
        {{ t('registry.contribute.note', { note }) }}
      </p>
      <p class="text-xs text-(--ui-text-dimmed)">
        {{ model.serverName }}:{{ model.remoteProcessId }}
      </p>
    </div>
    <div class="flex shrink-0 flex-wrap items-center gap-2 text-xs text-(--ui-text-muted)" :class="tile ? 'mt-auto' : ''">
      <span>
        {{ t('registry.changedOn', { date: changed }) }}
        <template v-if="showOwner"> · {{ t('registry.by', { name: ownerLabel(model) }) }}</template>
      </span>
      <UBadge v-if="model.interfaceState === 'drifted'" color="warning" variant="subtle" size="sm">
        {{ t('registry.contribute.interfaceChanged') }}
      </UBadge>
      <RegistryStatusBadge :status="model.status" />
    </div>
  </NuxtLink>
</template>
