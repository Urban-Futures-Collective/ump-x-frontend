<script setup lang="ts">
import type { RegistryModel } from '~/types/registry'

// The technical side of a model and its history: process id, interface as last read
// from the server, and every status change with its comment.
const props = defineProps<{ model: RegistryModel }>()
const { t, locale } = useI18n()
const { ownerLabel } = useRegistryPrototype()

const history = computed(() => [...props.model.history].reverse())
const when = (iso: string) => new Date(iso).toLocaleString(locale.value, { dateStyle: 'medium', timeStyle: 'short' })
</script>

<template>
  <div class="grid gap-4 lg:grid-cols-2">
    <UCard>
      <template #header>
        <h2 class="font-semibold">
          {{ t('registry.facts.title') }}
        </h2>
      </template>
      <dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
        <dt class="text-(--ui-text-muted)">
          {{ t('registry.facts.process') }}
        </dt>
        <dd><code>{{ model.serverName }}:{{ model.remoteProcessId }}</code></dd>
        <dt class="text-(--ui-text-muted)">
          {{ t('registry.facts.owner') }}
        </dt>
        <dd>{{ ownerLabel(model) }}</dd>
        <dt class="text-(--ui-text-muted)">
          {{ t('registry.facts.interface') }}
        </dt>
        <dd>{{ t(`registry.interface.${model.interfaceState}`) }}</dd>
        <template v-if="model.verifiedByName">
          <dt class="text-(--ui-text-muted)">
            {{ t('registry.facts.verifiedBy') }}
          </dt>
          <dd>{{ model.verifiedByName }}</dd>
        </template>
      </dl>
      <h3 class="mt-4 mb-2 text-sm font-medium">
        {{ t('registry.facts.inputs') }}
      </h3>
      <p v-if="!model.inputs.length" class="text-sm text-(--ui-text-muted)">
        {{ t('registry.facts.noInputs') }}
      </p>
      <table v-else class="w-full text-left text-sm">
        <thead class="text-xs text-(--ui-text-muted)">
          <tr>
            <th scope="col" class="py-1 font-medium">
              {{ t('registry.facts.inputName') }}
            </th>
            <th scope="col" class="py-1 font-medium">
              {{ t('registry.facts.inputType') }}
            </th>
            <th scope="col" class="py-1 font-medium">
              {{ t('registry.facts.inputRequired') }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="i in model.inputs" :key="i.name" class="border-t border-(--ui-border)">
            <td class="py-1">
              <code>{{ i.name }}</code>
            </td>
            <td class="py-1">
              {{ i.type }}
            </td>
            <td class="py-1">
              {{ i.required ? t('registry.yes') : t('registry.no') }}
            </td>
          </tr>
        </tbody>
      </table>
    </UCard>

    <UCard>
      <template #header>
        <h2 class="font-semibold">
          {{ t('registry.facts.history') }}
        </h2>
      </template>
      <p v-if="!history.length" class="text-sm text-(--ui-text-muted)">
        {{ t('registry.facts.noHistory') }}
      </p>
      <ol v-else class="space-y-3">
        <li v-for="(h, i) in history" :key="i" class="text-sm">
          <div class="flex flex-wrap items-center gap-2">
            <RegistryStatusBadge :status="h.to" />
            <span class="text-xs text-(--ui-text-muted)">{{ when(h.at) }}<template v-if="h.actorName"> · {{ h.actorName }}</template></span>
          </div>
          <p v-if="h.note" class="mt-1 text-(--ui-text-muted)">
            {{ h.note }}
          </p>
        </li>
      </ol>
    </UCard>
  </div>
</template>
