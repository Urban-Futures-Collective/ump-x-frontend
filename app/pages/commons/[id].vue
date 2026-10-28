<script setup lang="ts">
// A model in the Commons (design C1): its card from the registry and its interface
// from the process description. Without a card (registry off, or a process nobody
// registered) the page shows what OGC describes.
const { t, locale } = useI18n()
const route = useRoute()
const { isVerifier } = useUmpRoles()

const id = computed(() => String(route.params.id))
const { data: process, error } = useUmpProcess(id)
const { cards } = useCommonsCards()
const card = computed(() => {
  const c = cards.value.get(id.value)
  return c && (c.status === 'published' || isVerifier.value) ? c : undefined
})

// The card in the page language if it has one, else in its default language; a note
// offers the other language.
const lang = ref<'de' | 'en'>('en')
watch(card, (c) => {
  if (c) lang.value = cardLangs(c).includes(locale.value as 'de' | 'en') ? locale.value as 'de' | 'en' : c.defaultLang
}, { immediate: true })
const otherLang = computed(() => card.value ? cardLangs(card.value).find(l => l !== lang.value) : undefined)
const text = (f: 'fullName' | 'shortDescription' | 'purpose' | 'limitationsRisks') =>
  card.value ? card.value[f][lang.value] || card.value[f][card.value.defaultLang] || '' : ''

const title = computed(() => text('fullName') || process.value?.title || id.value)
const description = computed(() => text('shortDescription') || process.value?.description || '')

// The layout puts the model name into the breadcrumb.
const crumb = useState<string>('commons-crumb', () => '')
watchEffect(() => { crumb.value = title.value })
onBeforeUnmount(() => { crumb.value = '' })

const io = computed(() => [
  ...(process.value?.inputs ?? []).map(i => ({ key: i.name, label: i.name, description: i.description || (i.title !== i.name ? i.title : ''), output: false })),
  ...(process.value?.outputs ?? []).map(o => ({ key: `out-${o.name}`, label: o.name, description: o.description, output: true })),
])

const about = computed(() => {
  const c = card.value
  const req = c?.requirements ?? {}
  const minutes = req.runtimeSeconds ? Math.max(1, Math.round(req.runtimeSeconds / 60)) : 0
  return [
    { key: 'version', label: t('registry.card.version'), value: c?.versionLabel || process.value?.version || '' },
    { key: 'code', label: t('commons.model.code'), value: c?.repositoryUrl ? repoLabel(c.repositoryUrl) : '', link: c?.repositoryUrl },
    { key: 'runtime', label: t('commons.model.runtime'), value: minutes ? t('commons.model.minutes', { n: minutes }) : '' },
    {
      key: 'resources',
      label: t('commons.model.resources'),
      value: [req.cpuCores ? t('registry.review.cpu', { n: req.cpuCores }) : '', req.memoryGb ? t('registry.review.memory', { n: req.memoryGb }) : ''].filter(Boolean).join(' · '),
    },
  ].filter(r => r.value)
})

// "github.com/org/repo" reads better than the full URL.
function repoLabel(url: string) {
  try {
    const u = new URL(url)
    return `${u.host}${u.pathname}`.replace(/\/$/, '')
  }
  catch {
    return url
  }
}
</script>

<template>
  <section class="max-w-6xl space-y-6">
    <div class="flex flex-wrap items-start justify-between gap-4 lg:flex-nowrap">
      <div class="max-w-3xl min-w-0 space-y-3">
        <h1 class="text-3xl font-semibold text-ufc-slate-900">
          {{ title }}
        </h1>
        <p v-if="description" class="text-[0.9375rem]/[1.6] text-ufc-slate-700">
          {{ description }}
        </p>
        <p class="text-sm text-(--ui-text-dimmed)">
          {{ id }}
        </p>
        <CommonsTags v-if="card" :card="card" :topics="false" :langs="false" licence />
      </div>
      <div class="flex shrink-0 flex-wrap gap-2">
        <!-- Asking for access has no backend yet; same as in the account menu. -->
        <UButton color="neutral" variant="outline" size="lg" disabled>
          {{ t('auth.requestAccess') }}
        </UButton>
        <UButton icon="i-lucide-plus" size="lg" :to="{ path: '/run', query: { process: id } }">
          {{ t('commons.model.newScenario') }}
        </UButton>
      </div>
    </div>

    <p v-if="otherLang" class="inline-flex flex-wrap items-center gap-2 rounded-lg border border-ufc-gold-500 bg-white px-4 py-2 text-sm text-(--ui-text-muted)">
      {{ t('commons.model.otherLang', { lang: t(`commons.lang.${otherLang}`) }) }}
      <UButton size="xs" variant="link" class="p-0" @click="() => { lang = otherLang! }">
        {{ t('commons.model.switchLang') }}
      </UButton>
    </p>

    <p v-if="error && !card" class="text-sm text-red-600">
      {{ t('processes.error', { msg: apiErrorMessage(error) }) }}
    </p>

    <div class="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div class="space-y-6">
        <div v-if="text('purpose')" class="space-y-3 rounded-lg bg-white p-6">
          <h2 class="font-semibold">
            {{ t('registry.review.purpose') }}
          </h2>
          <p class="text-[0.9375rem]/[1.6]">
            {{ text('purpose') }}
          </p>
        </div>

        <div v-if="io.length" class="space-y-3 rounded-lg bg-white p-6">
          <h2 class="font-semibold">
            {{ t('commons.model.io') }}
          </h2>
          <dl class="divide-y divide-(--ui-border)">
            <div v-for="r in io" :key="r.key" class="grid gap-1 py-3 first:pt-0 last:pb-0 sm:grid-cols-[12rem_1fr] sm:gap-4">
              <dt class="text-sm font-medium break-words">
                <span v-if="r.output" aria-hidden="true">→ </span>
                <span v-if="r.output" class="sr-only">{{ t('registry.review.output') }}: </span>{{ r.label }}
              </dt>
              <dd class="text-sm text-(--ui-text-muted)">
                {{ r.description || t('registry.card.empty') }}
              </dd>
            </div>
          </dl>
        </div>

        <div v-if="text('limitationsRisks')" class="space-y-3 rounded-lg bg-white p-6">
          <h2 class="font-semibold">
            {{ t('registry.review.limits') }}
          </h2>
          <p class="text-[0.9375rem]/[1.6]">
            {{ text('limitationsRisks') }}
          </p>
        </div>
      </div>

      <aside class="space-y-6">
        <div v-if="about.length" class="space-y-3 rounded-lg bg-white p-6">
          <h2 class="font-semibold">
            {{ t('commons.model.about') }}
          </h2>
          <dl class="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
            <template v-for="r in about" :key="r.key">
              <dt class="text-(--ui-text-muted)">
                {{ r.label }}
              </dt>
              <dd class="min-w-0 break-words">
                <ULink v-if="r.link" :to="r.link" external target="_blank" class="text-(--ui-primary)">
                  {{ r.value }}
                </ULink>
                <template v-else>
                  {{ r.value }}
                </template>
              </dd>
            </template>
          </dl>
        </div>

        <div v-if="card && (card.contributors.length || card.literature.length)" class="space-y-3 rounded-lg bg-white p-6">
          <h2 class="font-semibold">
            {{ t('registry.review.people') }}
          </h2>
          <p v-if="card.contributors.length" class="text-sm">
            {{ card.contributors.map(c => c.role ? `${c.name} (${c.role})` : c.name).join(' · ') }}
          </p>
          <p v-for="l in card.literature" :key="l.citation" class="text-sm">
            {{ l.citation }}
          </p>
        </div>
      </aside>
    </div>
  </section>
</template>
