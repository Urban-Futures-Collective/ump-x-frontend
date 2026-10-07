<script setup lang="ts">
import type { ResultLayer } from '~/types/ump'

// Key figures and legend a model sends along with its result (see
// app/utils/resultExtras.ts). Shown below the map; nothing if the result has none.
const props = defineProps<{ layer?: ResultLayer | null }>()
const { t, locale } = useI18n()

const indicators = computed(() => indicatorsOf(props.layer?.featureCollection, locale.value))
const legend = computed(() => legendOf(props.layer?.featureCollection, locale.value))
</script>

<template>
  <div v-if="indicators.length || legend.length" class="space-y-4 rounded-lg border border-(--ui-border) bg-white p-4">
    <div v-if="legend.length" class="space-y-2">
      <h3 class="text-sm font-semibold">
        {{ t('results.legend') }}
      </h3>
      <ul class="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        <li v-for="entry in legend" :key="entry.title" class="flex items-center gap-2">
          <span class="inline-block h-1.5 w-6 rounded-full" :style="{ backgroundColor: entry.color }" aria-hidden="true" />
          {{ entry.title }}
        </li>
      </ul>
    </div>

    <table v-if="indicators.length" class="w-full text-left text-sm">
      <caption class="mb-2 text-left text-sm font-semibold">
        {{ t('results.indicators') }}
      </caption>
      <tbody>
        <tr v-for="item in indicators" :key="item.id" class="border-t border-(--ui-border) align-top">
          <th scope="row" class="py-2 pr-4 font-normal">
            {{ item.title }}
            <p v-if="item.description" class="text-xs text-(--ui-text-muted)">
              {{ item.description }}
            </p>
          </th>
          <td class="py-2 text-right font-medium whitespace-nowrap tabular-nums">
            {{ item.value }}
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
