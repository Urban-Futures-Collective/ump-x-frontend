<script setup lang="ts">
import type { RegistryModel } from '~/types/registry'
import type { TopicTone } from '~/utils/commons'

// The tag row of a model in the Commons (designs C0, C1): when it was published or,
// for models only verifiers can see yet, that they are there for verification; then
// whether it needs a log-in, or that the signed-in account has access; topics, languages or licence. The exact review status is
// on the Verify page.
const props = withDefaults(defineProps<{
  card: RegistryModel
  topics?: boolean
  langs?: boolean
  licence?: boolean
}>(), { topics: true, langs: true, licence: false })
const { t, locale } = useI18n()
const { loggedIn } = useOidcAuth()
const { roles } = useUmpRoles()

// For a model that needs access, say so only to those who lack it (#111, item 2).
const access = computed(() => {
  if (props.card.anonymousAccess) return { icon: 'i-lucide-globe', label: t('commons.noLogin') }
  if (loggedIn.value && runAccess(props.card, true, roles.value) === 'allowed') {
    return { icon: 'i-lucide-lock-open', label: t('commons.hasAccess') }
  }
  return { icon: 'i-lucide-lock', label: t('commons.accessRequired') }
})

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
  <ul class="flex flex-wrap items-center gap-2 text-xs">
    <li v-if="card.status !== 'published'" class="inline-flex items-center gap-1 rounded-full bg-orange-50 px-3 py-0.5 text-orange-800">
      <UIcon name="i-lucide-shield-user" class="size-3" aria-hidden="true" />
      {{ t('commons.onlyVerification') }}
    </li>
    <li v-else-if="published" class="inline-flex items-center gap-1 rounded-full bg-green-50 px-3 py-0.5 text-green-800">
      <UIcon name="i-lucide-check" class="size-3" aria-hidden="true" />
      {{ t('commons.published', { date: published }) }}
    </li>
    <li v-if="card.status === 'published'" class="inline-flex items-center gap-1 rounded-full bg-(--ui-bg-elevated) px-3 py-0.5">
      <UIcon :name="access.icon" class="size-3" aria-hidden="true" />
      {{ access.label }}
    </li>
    <template v-if="topics">
      <li v-for="k in card.keywords" :key="k" class="rounded-full px-3 py-0.5" :class="TONE[topicTone(k)]">
        {{ k }}
      </li>
    </template>
    <li v-if="licence && card.license" class="rounded-full bg-(--ui-bg-elevated) px-3 py-0.5 font-medium">
      {{ card.license }}
    </li>
    <li v-if="langs" class="rounded-full border border-(--ui-border-accented) px-3 py-0.5">
      <span class="sr-only">{{ t('commons.languages') }}</span>
      {{ cardLangs(card).map(l => l.toUpperCase()).join(' · ') }}
    </li>
  </ul>
</template>
