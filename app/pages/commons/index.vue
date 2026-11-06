<script setup lang="ts">
import type { ListFilter } from '~/types/list'
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
// Sort and filter in the ListBar as on every list page; a language filter only when
// there is more than one language to choose from.
const sort = ref<string>('published')
const sortItems = computed(() => [
  { value: 'published', label: t('commons.sort.published') },
  { value: 'name', label: t('commons.sort.name') },
])
const filter = ref<Record<string, string[]>>({})
// Tiles (default) or a compact list, switched in the ListBar as in Contribute.
const tiles = ref(true)
const asOptions = (list: string[]) => list.map(v => ({ value: v, label: v }))
const filters = computed<ListFilter[]>(() => [
  { key: 'topics', label: t('commons.filter.topic'), items: asOptions(options.value.topics), multiple: true },
  { key: 'langs', label: t('commons.filter.language'), items: options.value.langs.length > 1 ? options.value.langs.map(l => ({ value: l, label: l.toUpperCase() })) : [], multiple: true },
  { key: 'licences', label: t('commons.filter.licence'), items: asOptions(options.value.licences), multiple: true },
])

const shown = computed(() => sortCommons(entries.value.filter(e =>
  matchesSearch(search.value, e.title, e.description, e.id, ...(e.card?.keywords ?? []))
  && matchesFilter(e, { topics: filter.value.topics ?? [], langs: filter.value.langs ?? [], licences: filter.value.licences ?? [] })), sort.value as CommonsSort))
const filtered = computed(() => !!search.value || Object.values(filter.value).some(v => v.length))
</script>

<template>
  <section class="max-w-6xl space-y-6">
    <PageHeader :title="t('commons.title')" :intro="t('commons.intro')">
      <UInput
        v-model="search"
        type="search"
        icon="i-lucide-search"
        :placeholder="t('commons.search')"
        :aria-label="t('commons.search')"
        class="w-full sm:w-64"
      />
      <UButton v-if="canContribute" to="/contribute/new" icon="i-lucide-plus">
        {{ t('commons.contribute') }}
      </UButton>
    </PageHeader>

    <ListBar v-model:sort="sort" v-model:filter="filter" v-model:tiles="tiles" :sort-items="sortItems" :filters="filters">
      <p class="pb-2 text-sm text-(--ui-text-muted)" role="status">
        {{ t('commons.count', shown.length) }}<template v-if="shown.length">
          · {{ t('commons.fallbackLang') }}
        </template>
      </p>
    </ListBar>

    <p v-if="!loggedIn" class="text-sm text-(--ui-text-muted)">
      {{ t('commons.anonymousHint') }}
    </p>
    <p v-if="error" class="text-sm text-red-600">
      {{ t('processes.error', { msg: apiErrorMessage(error) }) }}
    </p>

    <template v-if="shown.length">
      <ul v-if="tiles" class="grid gap-4 lg:grid-cols-2">
        <li v-for="e in shown" :key="e.id">
          <ULink
            :to="`/commons/${e.id}`"
            class="group flex h-full flex-col gap-3 rounded-lg border border-(--ui-border) bg-white p-6 transition-shadow hover:shadow-md focus-visible:outline-2 focus-visible:outline-(--ui-primary)"
          >
            <span class="flex items-start justify-between gap-4">
              <span class="text-xl font-medium text-ufc-slate-900">{{ e.title }}</span>
              <UIcon name="i-lucide-arrow-right" class="mt-1 size-5 shrink-0 text-(--ui-primary)" aria-hidden="true" />
            </span>
            <span v-if="e.description" class="text-base/[1.6] text-ufc-slate-700">{{ e.description }}</span>
            <span class="text-sm text-(--ui-text-dimmed)">{{ e.id }}</span>
            <CommonsTags v-if="e.card" :card="e.card" class="mt-auto" />
          </ULink>
        </li>
      </ul>
      <!-- List: one row per model, description shortened to one line. -->
      <ul v-else class="space-y-3">
        <li v-for="e in shown" :key="e.id">
          <ULink
            :to="`/commons/${e.id}`"
            class="group flex items-center gap-4 rounded-lg border border-(--ui-border) bg-white px-5 py-4 transition-shadow hover:shadow-md focus-visible:outline-2 focus-visible:outline-(--ui-primary)"
          >
            <span class="min-w-0 flex-1 space-y-1">
              <span class="flex flex-wrap items-baseline gap-x-3">
                <span class="text-lg font-medium text-ufc-slate-900">{{ e.title }}</span>
                <span class="text-sm text-(--ui-text-dimmed)">{{ e.id }}</span>
              </span>
              <span v-if="e.description" class="block truncate text-sm text-ufc-slate-700">{{ e.description }}</span>
              <CommonsTags v-if="e.card" :card="e.card" class="pt-1" />
            </span>
            <UIcon name="i-lucide-arrow-right" class="size-5 shrink-0 text-(--ui-primary)" aria-hidden="true" />
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
