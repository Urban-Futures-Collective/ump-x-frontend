<script setup lang="ts">
import type { RegistryModel } from '~/types/registry'
import type { TopicTone } from '~/utils/commons'

// The tag row of a model in the Commons (designs C0, C1): when it was published or,
// for verifiers, its review status; then topics, languages or licence.
//
// "No log-in required" / "Access required" from the design is missing on purpose: the
// registry does not report anonymous access yet, and guessing it would be worse than
// leaving it out.
const props = withDefaults(defineProps<{
  card: RegistryModel
  topics?: boolean
  langs?: boolean
  licence?: boolean
}>(), { topics: true, langs: true, licence: false })
const { t, locale } = useI18n()

const published = computed(() => props.card.status === 'published' && props.card.publishedAt
  ? new Date(props.card.publishedAt).toLocaleDateString(locale.value, { day: 'numeric', month: 'short', year: 'numeric' })
  : '')

const TONE: Record<TopicTone, string> = {
  gold: 'bg-ufc-gold-300 text-ufc-gold-950',
  teal: 'bg-ufc-teal-600 text-white',
  blue: 'bg-ufc-blue-100 text-ufc-blue-900',
  plum: 'bg-ufc-plum-600 text-white',
}
</script>

<template>
  <ul class="flex flex-wrap items-center gap-2 text-sm">
    <li v-if="card.status !== 'published'">
      <RegistryStatusBadge :status="card.status" />
    </li>
    <li v-else-if="published" class="inline-flex items-center gap-1 rounded-full bg-green-50 px-3 py-0.5 text-green-800">
      <UIcon name="i-lucide-check" class="size-3.5" aria-hidden="true" />
      {{ t('commons.published', { date: published }) }}
    </li>
    <template v-if="topics">
      <li v-for="k in card.keywords" :key="k" class="rounded-full px-3 py-0.5" :class="TONE[topicTone(k)]">
        {{ k }}
      </li>
    </template>
    <li v-if="licence && card.license" class="rounded-full bg-(--ui-bg-elevated) px-3 py-0.5 font-medium">
      {{ card.license }}
    </li>
    <li v-if="langs" class="rounded-full border border-(--ui-border-accented) px-3 py-0.5 text-xs">
      <span class="sr-only">{{ t('commons.languages') }}</span>
      {{ cardLangs(card).map(l => l.toUpperCase()).join(' · ') }}
    </li>
  </ul>
</template>
