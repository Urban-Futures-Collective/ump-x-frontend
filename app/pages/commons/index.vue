<script setup lang="ts">
import type { CommonsEntry, CommonsSort } from '~/utils/commons'

// Commons (design C0): the models the caller may use, as cards that lead to the model
// page. UMP filters the process list by role, so it decides what is listed; the
// registry adds topics, languages, licence and publication date where a model card
// exists.
const { t, locale } = useI18n()
const { loggedIn } = useOidcAuth()
const { isProvider, isVerifier } = useUmpRoles()
const { prototypes, registryApi } = useRuntimeConfig().public
const { data: processes, pending, error } = useUmpProcesses()
const { cards } = useCommonsCards()

// Contributing needs the registry pages; signed-out visitors are sent to the login.
const canContribute = computed(() => (prototypes || registryApi) && (!loggedIn.value || isProvider.value))

const entries = computed<CommonsEntry[]>(() => (processes.value ?? []).map((p) => {
  const card = cards.value.get(p.id)
  // Only verifiers see models under review; for everyone else a card that is not
  // published adds nothing.
  const usable = card && (card.status === 'published' || isVerifier.value) ? card : undefined
  return {
    id: p.id,
    title: usable ? pickLang(usable.fullName, locale.value, usable.defaultLang) || p.title : p.title,
    description: usable ? pickLang(usable.shortDescription, locale.value, usable.defaultLang) || p.description : p.description,
    card: usable,
  }
}))

const options = computed(() => filterOptions(entries.value))
const search = ref('')
const topics = ref<string[]>([])
const langs = ref<string[]>([])
const licences = ref<string[]>([])
const sort = ref<CommonsSort>('published')
const sortItems = computed(() => [
  { label: t('commons.sort.published'), value: 'published' },
  { label: t('commons.sort.name'), value: 'name' },
])
const langItems = computed(() => options.value.langs.map(l => ({ label: l.toUpperCase(), value: l })))

const shown = computed(() => sortCommons(entries.value.filter(e =>
  matchesSearch(search.value, e.title, e.description, e.id, ...(e.card?.keywords ?? []))
  && matchesFilter(e, { topics: topics.value, langs: langs.value, licences: licences.value })), sort.value))
const filtered = computed(() => !!(search.value || topics.value.length || langs.value.length || licences.value.length))
function reset() {
  search.value = ''
  topics.value = []
  langs.value = []
  licences.value = []
}
</script>

<template>
  <section class="space-y-8">
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div class="space-y-2">
        <h1 class="text-3xl font-semibold text-ufc-slate-900">
          {{ t('commons.title') }}
        </h1>
        <p class="text-[0.9375rem] text-(--ui-text-muted)">
          {{ t('commons.intro') }}
        </p>
      </div>
      <UButton v-if="canContribute" to="/contribute/new" icon="i-lucide-plus" size="lg">
        {{ t('commons.contribute') }}
      </UButton>
    </div>

    <div class="flex flex-wrap items-center gap-3">
      <UInput
        v-model="search"
        type="search"
        icon="i-lucide-search"
        :placeholder="t('commons.search')"
        :aria-label="t('commons.search')"
        class="w-full sm:w-72"
      />
      <USelectMenu
        v-if="options.topics.length"
        v-model="topics"
        :items="options.topics"
        multiple
        :search-input="false"
        :placeholder="t('commons.filter.topic')"
        :aria-label="t('commons.filter.topic')"
        class="w-40"
      />
      <USelectMenu
        v-if="langItems.length > 1"
        v-model="langs"
        :items="langItems"
        value-key="value"
        multiple
        :search-input="false"
        :placeholder="t('commons.filter.language')"
        :aria-label="t('commons.filter.language')"
        class="w-36"
      />
      <USelectMenu
        v-if="options.licences.length"
        v-model="licences"
        :items="options.licences"
        multiple
        :search-input="false"
        :placeholder="t('commons.filter.licence')"
        :aria-label="t('commons.filter.licence')"
        class="w-40"
      />
      <UButton v-if="filtered" color="neutral" variant="link" @click="reset">
        {{ t('commons.filter.reset') }}
      </UButton>
      <USelect
        v-model="sort"
        :items="sortItems"
        icon="i-lucide-arrow-down-up"
        variant="ghost"
        :aria-label="t('commons.sort.label')"
        class="ml-auto w-72"
      />
    </div>

    <p v-if="!loggedIn" class="text-sm text-(--ui-text-muted)">
      {{ t('commons.anonymousHint') }}
    </p>
    <p v-if="error" class="text-sm text-red-600">
      {{ t('processes.error', { msg: apiErrorMessage(error) }) }}
    </p>

    <template v-if="shown.length">
      <p class="text-sm text-(--ui-text-muted)" role="status">
        {{ t('commons.count', shown.length) }} · {{ t('commons.fallbackLang') }}
      </p>
      <ul class="grid gap-4 lg:grid-cols-2">
        <li v-for="e in shown" :key="e.id">
          <ULink
            :to="`/commons/${e.id}`"
            class="group flex h-full flex-col gap-3 rounded-lg border border-(--ui-border) bg-white p-6 transition-shadow hover:shadow-md focus-visible:outline-2 focus-visible:outline-(--ui-primary)"
          >
            <span class="flex items-start justify-between gap-4">
              <span class="text-xl font-medium text-ufc-slate-900">{{ e.title }}</span>
              <UIcon name="i-lucide-arrow-right" class="mt-1 size-5 shrink-0 text-(--ui-primary)" aria-hidden="true" />
            </span>
            <span v-if="e.description" class="text-[0.9375rem]/[1.6] text-ufc-slate-700">{{ e.description }}</span>
            <span class="text-sm text-(--ui-text-dimmed)">{{ e.id }}</span>
            <CommonsTags v-if="e.card" :card="e.card" class="mt-auto" />
          </ULink>
        </li>
      </ul>
    </template>
    <p v-else-if="filtered && processes?.length" class="text-sm text-(--ui-text-muted)" role="status">
      {{ t('commons.noMatch') }}
    </p>
    <p v-else-if="!pending && !error" class="text-sm text-(--ui-text-muted)">
      {{ t('processes.empty') }}
    </p>

    <p class="rounded-lg border border-ufc-gold-500 bg-white px-4 py-3 text-sm text-(--ui-text-muted)">
      {{ t('commons.onlyPublished') }}
    </p>
  </section>
</template>
