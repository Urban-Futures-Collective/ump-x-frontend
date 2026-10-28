<script setup lang="ts">
// The model card as the provider wrote it, read-only, for reviewers (design V2, opened
// from the review page). Language switch for cards in several languages; the model can
// be run from here too.
definePageMeta({ middleware: ['auth', 'prototype', 'verifier'] })
const { t, locale } = useI18n()
const route = useRoute()
const { byId, isLive } = useRegistry()

const id = computed(() => String(route.params.id))
const model = computed(() => byId(id.value))
const processId = computed(() => model.value ? `${model.value.serverName}:${model.value.remoteProcessId}` : '')

// The card's languages, default first; shown in the page language if the card has it.
const langs = computed(() => {
  const m = model.value
  if (!m) return []
  return [m.defaultLang, ...(['de', 'en'] as const).filter(l => l !== m.defaultLang && m.fullName[l])]
})
const lang = ref<'de' | 'en'>('en')
watch(langs, (ls) => { lang.value = ls.includes(locale.value as 'de' | 'en') ? locale.value as 'de' | 'en' : ls[0] ?? 'en' }, { immediate: true })

const text = (f: 'fullName' | 'shortDescription' | 'purpose' | 'limitationsRisks') =>
  model.value?.[f][lang.value] ?? ''

const sections = computed(() => {
  const m = model.value
  if (!m) return []
  const req = m.requirements
  return [
    { key: 'description', label: t('registry.card.shortDescription'), value: text('shortDescription') },
    { key: 'purpose', label: t('registry.review.purpose'), value: text('purpose') },
    { key: 'licence', label: t('registry.review.licence'), value: m.license, link: m.repositoryUrl },
    { key: 'limits', label: t('registry.review.limits'), value: text('limitationsRisks') },
    {
      key: 'people',
      label: t('registry.review.people'),
      value: [...m.contributors.map(c => `${c.name} (${c.role})`), ...m.literature.map(l => l.citation)].join(' · '),
    },
    {
      key: 'requirements',
      label: t('registry.review.requirements'),
      value: [
        req.cpuCores ? t('registry.review.cpu', { n: req.cpuCores }) : '',
        req.memoryGb ? t('registry.review.memory', { n: req.memoryGb }) : '',
        req.runtimeSeconds ? t('registry.review.runtime', { n: Math.round(req.runtimeSeconds) }) : '',
      ].filter(Boolean).join(' · '),
    },
    { key: 'testRun', label: t('registry.cardView.testRun'), value: m.testCases.map(c => c.name).join(' · ') },
  ]
})
</script>

<template>
  <section class="max-w-6xl space-y-6">
    <PrototypeNotice />

    <p v-if="!model" class="text-(--ui-text-muted)">
      {{ t('registry.notFound') }}
    </p>

    <template v-else>
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div class="space-y-1">
          <div class="flex flex-wrap items-center gap-3">
            <h1 class="text-2xl font-semibold text-ufc-slate-900">
              {{ text('fullName') || model.remoteProcessId }}
            </h1>
            <RegistryStatusBadge :status="model.status" />
          </div>
          <p class="text-sm text-(--ui-text-muted)">
            {{ processId }}<template v-if="model.versionLabel">
              · v{{ model.versionLabel }}
            </template>
          </p>
        </div>
        <div v-if="langs.length > 1" class="flex items-center gap-2 text-sm">
          <span class="text-(--ui-text-muted)">{{ t('registry.cardView.languages') }}</span>
          <UButton
            v-for="l in langs"
            :key="l"
            size="xs"
            :variant="l === lang ? 'solid' : 'outline'"
            :color="l === lang ? 'primary' : 'neutral'"
            :aria-pressed="l === lang"
            @click="() => { lang = l }"
          >
            {{ l.toUpperCase() }}<template v-if="l === model.defaultLang">
              · {{ t('registry.cardView.default') }}
            </template>
          </UButton>
        </div>
      </div>

      <div class="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <UCard>
          <template #header>
            <h2 class="font-semibold">
              {{ t('registry.review.card') }}
            </h2>
            <p class="text-xs text-(--ui-text-muted)">
              {{ t('registry.cardView.readOnly') }}
            </p>
          </template>
          <dl class="divide-y divide-(--ui-border)">
            <div v-for="s in sections" :key="s.key" class="grid gap-1 py-3 first:pt-0 last:pb-0 sm:grid-cols-[12rem_1fr] sm:gap-4">
              <dt class="text-sm font-medium">
                {{ s.label }}
              </dt>
              <dd class="text-sm text-(--ui-text-muted)">
                {{ s.value || t('registry.card.empty') }}
                <ULink v-if="s.link" :to="s.link" external target="_blank" class="block break-all text-(--ui-primary)">
                  {{ s.link }}
                </ULink>
              </dd>
            </div>
          </dl>
        </UCard>

        <aside class="space-y-3 rounded-lg bg-ufc-blue-50 p-5">
          <h2 class="font-semibold">
            {{ t('registry.review.run') }}
          </h2>
          <p class="text-xs text-(--ui-text-muted)">
            {{ isLive ? t('registry.cardView.runHint') : t('registry.verify.testRunNote') }}
          </p>
          <UButton
            block
            icon="i-lucide-play"
            :disabled="!isLive"
            :to="isLive ? `/run?process=${encodeURIComponent(processId)}` : undefined"
            target="_blank"
          >
            {{ t('registry.review.runStart') }}
          </UButton>
          <UButton block color="neutral" variant="outline" :to="`/verify/${id}`">
            {{ t('registry.cardView.back') }}
          </UButton>
        </aside>
      </div>
    </template>
  </section>
</template>
