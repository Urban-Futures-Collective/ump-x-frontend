<script setup lang="ts">
import type { ContributorRole, LangMap, RegistryCardEdit, RegistryIo } from '~/types/registry'
import { CONTRIBUTOR_ROLES } from '~/types/registry'

// One of the provider's models: the model card (design: Contribute › Model card, fields
// as in UMP's model-card schema), the review status with the reviewer's comment, and
// submitting or withdrawing. Sections on the left, the card in the middle, what is still
// missing for review on the right.
definePageMeta({ middleware: ['auth', 'prototype', 'provider'] })
const { t, locale } = useI18n()
const route = useRoute()
const { byId, actorFor, transition, updateCard, modelIo } = useRegistry()
const toast = useToast()
const busy = ref(false)

const model = computed(() => byId(String(route.params.id)))
const actor = computed(() => model.value ? actorFor(model.value) : null)
const editable = computed(() => !!model.value && !!actor.value && canEditCard(model.value.status, actor.value))
const actions = computed(() => model.value && actor.value ? transitionsFor(model.value.status, actor.value) : [])

type Lang = 'de' | 'en'
const LANGS: Lang[] = ['en', 'de']
// Language names in their own language on the switch, in the page language elsewhere.
const langName = (l: Lang) => l === 'de' ? 'Deutsch' : 'English'
const langLabel = (l: Lang) => t(`registry.card.lang.${l}`)

// The card as a copy with every list present, saved explicitly.
type Card = Required<Pick<RegistryCardEdit,
  'defaultLang' | 'fullName' | 'shortDescription' | 'purpose' | 'limitationsRisks' | 'license' | 'repositoryUrl' | 'versionLabel'
  | 'keywordsByLang' | 'codeRef' | 'contributors' | 'literature' | 'applications' | 'requirements' | 'testCases' | 'ioNotes'>>
function cardOf(): Card {
  const m = structuredClone(toRaw(model.value!))
  return {
    defaultLang: m.defaultLang,
    fullName: m.fullName,
    shortDescription: m.shortDescription,
    purpose: m.purpose,
    limitationsRisks: m.limitationsRisks,
    license: m.license,
    repositoryUrl: m.repositoryUrl,
    versionLabel: m.versionLabel,
    keywordsByLang: m.keywordsByLang ?? { [m.defaultLang]: m.keywords },
    codeRef: m.codeRef ?? '',
    contributors: m.contributors,
    literature: m.literature,
    applications: (m.applications ?? []).map(a => ({ ...a, description: a.description ?? {} })),
    requirements: m.requirements,
    testCases: m.testCases.map(c => ({ ...c, description: c.description ?? {} })),
    ioNotes: m.ioNotes ?? {},
  }
}
const card = ref<Card | null>(model.value ? cardOf() : null)
// With the live registry the model arrives after the page.
watch(model, (m) => { if (m && !card.value) card.value = cardOf() })
const saved = ref(false)
watch(card, () => { saved.value = false }, { deep: true })

// Translatable fields show one language at a time; the default language comes first.
const editLang = ref<Lang>(model.value?.defaultLang ?? 'en')
watch(() => card.value?.defaultLang, (l) => { if (l) editLang.value = l }, { once: true })
const isDefault = computed(() => editLang.value === card.value?.defaultLang)
const otherFilled = computed(() => {
  const c = card.value
  if (!c) return 0
  const other: Lang = c.defaultLang === 'de' ? 'en' : 'de'
  return (['fullName', 'shortDescription', 'purpose', 'limitationsRisks'] as const).filter(f => c[f][other]?.trim()).length
})

// Inputs and outputs from the model server, for the notes section.
const io = ref<RegistryIo[]>([])
const ioError = ref(false)
watch(() => model.value?.id, async (id) => {
  if (!id) return
  try {
    io.value = await modelIo(id)
    ioError.value = false
  }
  catch {
    ioError.value = true
  }
}, { immediate: true })

// Every listed input and output gets an entry, so the template can bind to it.
watchEffect(() => {
  const notes = card.value?.ioNotes
  if (notes) for (const x of io.value) notes[x.id] ??= {}
})

// What UMP requires before review (name and purpose in the default language, a licence)
// and what speeds review up.
const has = (map: LangMap | undefined, l: Lang) => !!map?.[l]?.trim()
const required = computed(() => {
  const c = card.value
  if (!c) return []
  return [
    { key: 'name', label: t('registry.card.req.name', { lang: langLabel(c.defaultLang) }), ok: has(c.fullName, c.defaultLang) },
    { key: 'purpose', label: t('registry.card.req.purpose', { lang: langLabel(c.defaultLang) }), ok: has(c.purpose, c.defaultLang) },
    { key: 'license', label: t('registry.card.license'), ok: !!c.license.trim() },
  ]
})
const recommended = computed(() => {
  const c = card.value
  if (!c) return []
  return [
    { key: 'test', label: t('registry.card.req.test'), ok: c.testCases.length > 0 },
    { key: 'limits', label: t('registry.card.sections.limitations'), ok: has(c.limitationsRisks, c.defaultLang) },
    { key: 'langs', label: t('registry.card.req.langs'), ok: otherFilled.value > 0 },
  ]
})
const missing = computed(() => required.value.filter(r => !r.ok))

// Sections, with their state for the list on the left and a summary when closed.
type State = 'done' | 'warn' | 'empty'
const sections = computed(() => {
  const c = card.value
  if (!c) return []
  const r = c.requirements
  const notes = Object.values(c.ioNotes).filter(m => Object.values(m).some(v => v?.trim())).length
  const kw = c.keywordsByLang[editLang.value]?.length ?? 0
  const reqParts = [r.cpuCores && `${r.cpuCores} CPU`, r.memoryGb && `${r.memoryGb} GB`, r.runtimeSeconds && `~${r.runtimeSeconds} s`].filter(Boolean)
  const list: { id: string, title: string, summary: string, state: State }[] = [
    { id: 'basics', title: t('registry.card.sections.basics'), summary: [inLang(c.fullName, editLang.value, c.defaultLang), c.versionLabel && `v${c.versionLabel}`, t('registry.card.keywordCount', kw)].filter(Boolean).join(' · '), state: has(c.fullName, c.defaultLang) ? 'done' : 'warn' },
    { id: 'purpose', title: t('registry.card.sections.purpose'), summary: t('registry.card.applicationCount', c.applications.length), state: has(c.purpose, c.defaultLang) ? 'done' : 'warn' },
    { id: 'licence', title: t('registry.card.sections.licence'), summary: c.license || t('registry.card.required'), state: c.license.trim() ? 'done' : 'warn' },
    { id: 'limitations', title: t('registry.card.sections.limitations'), summary: has(c.limitationsRisks, c.defaultLang) ? t('registry.card.filled') : t('registry.card.recommendedEmpty'), state: has(c.limitationsRisks, c.defaultLang) ? 'done' : 'empty' },
    { id: 'people', title: t('registry.card.sections.people'), summary: `${t('registry.card.peopleCount', c.contributors.length)} · ${t('registry.card.referenceCount', c.literature.length)}`, state: c.contributors.length || c.literature.length ? 'done' : 'empty' },
    { id: 'requirements', title: t('registry.card.sections.requirements'), summary: reqParts.join(' · ') || t('registry.card.requirementsHint'), state: reqParts.length || r.gpu !== undefined || r.software?.length ? 'done' : 'empty' },
    { id: 'test', title: t('registry.card.sections.test'), summary: c.testCases.length ? t('registry.card.testCount', c.testCases.length) : t('registry.card.testHint'), state: c.testCases.length ? 'done' : 'empty' },
    { id: 'io', title: t('registry.card.sections.io'), summary: io.value.length ? t('registry.card.ioCount', { n: notes, of: io.value.length }) : t('registry.card.optional'), state: notes ? 'done' : 'empty' },
    { id: 'run', title: t('registry.card.sections.run'), summary: model.value?.anonymousAccess ? t('registry.card.run.anyone') : t('registry.card.run.signedIn'), state: 'done' },
  ]
  return list
})
const open = ref<Record<string, boolean>>({ basics: true, purpose: true })
const active = ref('basics')
function goTo(id: string) {
  open.value[id] = true
  active.value = id
  nextTick(() => document.getElementById(`card-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
}

// List helpers for the repeated groups.
function addApplication() {
  card.value?.applications.push({ title: {}, description: {} })
}
function addContributor() {
  card.value?.contributors.push({ name: '', role: 'author' })
}
function addReference() {
  card.value?.literature.push({ citation: '' })
}
function addTestCase() {
  card.value?.testCases.push({ name: '', inputUrl: '', expectedOutputUrl: '', description: {} })
}
const roleItems = computed(() => CONTRIBUTOR_ROLES.map(r => ({ label: t(`registry.card.roles.${r}`), value: r })))

// GPU: not needed, any, or a named model (UMP takes a boolean or a text).
const gpuMode = computed({
  get: () => {
    const g = card.value?.requirements.gpu
    return g === true ? 'any' : typeof g === 'string' && g ? 'model' : 'none'
  },
  set: (v: string) => {
    if (!card.value) return
    card.value.requirements.gpu = v === 'any' ? true : v === 'model' ? ' ' : false
  },
})
const gpuName = computed({
  get: () => typeof card.value?.requirements.gpu === 'string' ? card.value.requirements.gpu.trim() : '',
  set: (v: string) => { if (card.value) card.value.requirements.gpu = v || ' ' },
})
const gpuItems = computed(() => [
  { label: t('registry.card.gpu.none'), value: 'none' },
  { label: t('registry.card.gpu.any'), value: 'any' },
  { label: t('registry.card.gpu.model'), value: 'model' },
])

// Keywords of the language being edited.
const keywords = computed({
  get: () => card.value?.keywordsByLang[editLang.value] ?? [],
  set: (v: string[]) => { if (card.value) card.value.keywordsByLang[editLang.value] = v },
})
const software = computed({
  get: () => card.value?.requirements.software ?? [],
  set: (v: string[]) => { if (card.value) card.value.requirements.software = v },
})

// Errors are shown, not swallowed: a refused save (e.g. changed elsewhere in the
// meantime) must not look like a saved one.
async function attempt(work: () => Promise<void>): Promise<boolean> {
  busy.value = true
  try {
    await work()
    return true
  }
  catch (e) {
    toast.add({ title: t('registry.failed'), description: apiErrorMessage(e), color: 'error' })
    return false
  }
  finally {
    busy.value = false
  }
}

async function save() {
  if (!model.value || !card.value) return false
  const id = model.value.id
  const edit = structuredClone(toRaw(card.value))
  if (typeof edit.requirements.gpu === 'string') edit.requirements.gpu = edit.requirements.gpu.trim() || true
  saved.value = await attempt(() => updateCard(id, edit))
  return saved.value
}

async function act(to: (typeof actions.value)[number]['to']) {
  if (!model.value) return
  const id = model.value.id
  if (to === 'submitted' && !(await save())) return
  await attempt(() => transition(id, to))
}
const submit = computed(() => actions.value.find(a => a.to === 'submitted'))
const otherActions = computed(() => actions.value.filter(a => a.to !== 'submitted'))

const title = computed(() => model.value ? inLang(model.value.fullName, locale.value, model.value.defaultLang) || model.value.remoteProcessId : '')
usePageCrumb(() => title.value)
</script>

<template>
  <section class="max-w-7xl space-y-6">
    <PrototypeNotice />

    <p v-if="!model" class="text-(--ui-text-muted)">
      {{ t('registry.notFound') }}
    </p>

    <template v-else-if="card">
      <div class="flex flex-wrap items-end justify-between gap-4">
        <div class="flex flex-wrap items-center gap-3">
          <h1 class="text-3xl font-semibold text-ufc-slate-900">
            {{ title }}
          </h1>
          <RegistryStatusBadge :status="model.status" />
        </div>
        <div class="flex flex-wrap items-center gap-2 text-sm">
          <span class="text-(--ui-text-muted)">{{ t('registry.card.languages') }}</span>
          <UButton
            v-for="l in LANGS"
            :key="l"
            size="sm"
            :color="editLang === l ? 'primary' : 'neutral'"
            :variant="editLang === l ? 'solid' : 'outline'"
            :aria-pressed="editLang === l"
            @click="() => { editLang = l }"
          >
            {{ langName(l) }}{{ l === card.defaultLang ? ` · ${t('registry.card.default')}` : '' }}
          </UButton>
        </div>
      </div>

      <UAlert
        v-if="model.statusNote && (model.status === 'changes_requested' || model.status === 'rejected' || model.status === 'deactivated')"
        color="neutral"
        variant="subtle"
        :ui="{ icon: model.status === 'changes_requested' ? 'text-(--ui-warning)' : 'text-(--ui-error)' }"
        icon="i-lucide-message-square"
        :title="t(`registry.noteTitle.${model.status}`)"
        :description="model.statusNote"
      />

      <div class="grid items-start gap-6 lg:grid-cols-[14rem_minmax(0,1fr)] xl:grid-cols-[14rem_minmax(0,1fr)_18rem]">
        <!-- Sections -->
        <nav :aria-label="t('registry.card.title')" class="rounded-lg bg-white p-3 lg:sticky lg:top-4">
          <ul class="space-y-1">
            <li v-for="s in sections" :key="s.id">
              <button
                type="button"
                class="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm"
                :class="active === s.id ? 'bg-ufc-blue-50 font-medium' : 'hover:bg-(--ui-bg-elevated)'"
                @click="goTo(s.id)"
              >
                <UIcon v-if="s.state === 'done'" name="i-lucide-circle-check" class="size-4 shrink-0 text-(--ui-success)" />
                <UIcon v-else-if="s.state === 'warn'" name="i-lucide-circle-alert" class="size-4 shrink-0 text-(--ui-warning)" />
                <UIcon v-else name="i-lucide-circle" class="size-4 shrink-0 text-(--ui-text-dimmed)" />
                {{ s.title }}
              </button>
            </li>
          </ul>
        </nav>

        <!-- The card -->
        <fieldset :disabled="!editable" class="min-w-0 overflow-hidden rounded-lg bg-white">
          <legend class="sr-only">
            {{ t('registry.card.title') }}
          </legend>

          <ModelCardSection id="basics" v-model:open="open.basics" :title="t('registry.card.sections.basics')" :summary="t('registry.card.fromServer')">
            <div class="grid gap-4 sm:grid-cols-[minmax(0,1fr)_12rem]">
              <UFormField :required="isDefault">
                <template #label>
                  {{ t('registry.card.fullName') }} <LangTag :lang="editLang" />
                </template>
                <UInput v-model="card.fullName[editLang]" class="w-full" />
              </UFormField>
              <UFormField :label="t('registry.card.version')">
                <UInput v-model="card.versionLabel" class="w-full" />
              </UFormField>
            </div>
            <UFormField :help="t('registry.card.shortDescriptionHint')">
              <template #label>
                {{ t('registry.card.shortDescription') }} <LangTag :lang="editLang" />
              </template>
              <UTextarea v-model="card.shortDescription[editLang]" :rows="2" autoresize class="w-full" />
            </UFormField>
            <UFormField :help="t('registry.card.keywordsHint')">
              <template #label>
                {{ t('registry.card.keywords') }} <LangTag :lang="editLang" />
              </template>
              <UInputTags v-model="keywords" :placeholder="t('registry.card.tagPlaceholder')" class="w-full" />
            </UFormField>
            <UFormField :label="t('registry.card.defaultLang')" :help="t('registry.card.defaultLangHint')">
              <USelect v-model="card.defaultLang" :items="LANGS.map(l => ({ label: langName(l), value: l }))" class="w-48" />
            </UFormField>
          </ModelCardSection>

          <ModelCardSection id="purpose" v-model:open="open.purpose" :title="t('registry.card.sections.purpose')" :summary="sections[1]?.summary">
            <UFormField :required="isDefault" :help="t('registry.card.purposeHint')">
              <template #label>
                {{ t('registry.card.purposeLabel') }} <LangTag :lang="editLang" />
              </template>
              <UTextarea v-model="card.purpose[editLang]" :rows="3" autoresize class="w-full" />
            </UFormField>
            <div class="space-y-3">
              <div>
                <p class="text-sm font-medium">
                  {{ t('registry.card.applications') }}
                </p>
                <p class="text-xs text-(--ui-text-muted)">
                  {{ t('registry.card.applicationsHint') }}
                </p>
              </div>
              <div v-for="(a, i) in card.applications" :key="i" class="space-y-3 rounded-lg border border-(--ui-border) p-4">
                <div class="flex items-center justify-between">
                  <p class="text-xs font-medium tracking-wide text-(--ui-text-muted) uppercase">
                    {{ t('registry.card.application', { n: i + 1 }) }}
                  </p>
                  <UButton color="error" variant="link" size="xs" @click="() => { card?.applications.splice(i, 1) }">
                    {{ t('registry.card.remove') }}
                  </UButton>
                </div>
                <div class="grid gap-3 sm:grid-cols-[minmax(0,1fr)_10rem_6rem]">
                  <UFormField :required="isDefault">
                    <template #label>
                      {{ t('registry.card.appTitle') }} <LangTag :lang="editLang" />
                    </template>
                    <UInput v-model="a.title[editLang]" class="w-full" />
                  </UFormField>
                  <UFormField :label="t('registry.card.location')">
                    <UInput v-model="a.location" class="w-full" />
                  </UFormField>
                  <UFormField :label="t('registry.card.year')">
                    <UInput v-model.number="a.year" type="number" class="w-full" />
                  </UFormField>
                </div>
                <UFormField :label="t('registry.card.link')">
                  <UInput v-model="a.url" type="url" placeholder="https://" class="w-full" />
                </UFormField>
                <UFormField>
                  <template #label>
                    {{ t('registry.card.description') }} <LangTag :lang="editLang" />
                  </template>
                  <UTextarea v-model="a.description![editLang]" :rows="2" autoresize class="w-full" />
                </UFormField>
              </div>
              <UButton color="neutral" variant="outline" icon="i-lucide-plus" @click="addApplication">
                {{ t('registry.card.addApplication') }}
              </UButton>
            </div>
          </ModelCardSection>

          <ModelCardSection id="licence" v-model:open="open.licence" :title="t('registry.card.sections.licence')" :summary="sections[2]?.summary">
            <div class="grid gap-4 sm:grid-cols-2">
              <UFormField :label="t('registry.card.license')" required :help="t('registry.card.licenseHint')">
                <LicenseSelect v-model="card.license" />
              </UFormField>
              <UFormField :label="t('registry.card.repository')">
                <UInput v-model="card.repositoryUrl" type="url" placeholder="https://" class="w-full" />
              </UFormField>
              <UFormField :label="t('registry.card.codeRef')" :help="t('registry.card.codeRefHint')">
                <UInput v-model="card.codeRef" class="w-full" />
              </UFormField>
            </div>
          </ModelCardSection>

          <ModelCardSection id="limitations" v-model:open="open.limitations" :title="t('registry.card.sections.limitations')" :summary="sections[3]?.summary">
            <UFormField :help="t('registry.card.limitationsHint')">
              <template #label>
                {{ t('registry.card.limitationsRisks') }} <LangTag :lang="editLang" />
              </template>
              <UTextarea v-model="card.limitationsRisks[editLang]" :rows="3" autoresize class="w-full" />
            </UFormField>
          </ModelCardSection>

          <ModelCardSection id="people" v-model:open="open.people" :title="t('registry.card.sections.people')" :summary="sections[4]?.summary">
            <div class="space-y-3">
              <div>
                <p class="text-sm font-medium">
                  {{ t('registry.card.people') }}
                </p>
                <p class="text-xs text-(--ui-text-muted)">
                  {{ t('registry.card.peopleHint') }}
                </p>
              </div>
              <div v-for="(c, i) in card.contributors" :key="i" class="space-y-3 rounded-lg border border-(--ui-border) p-4">
                <div class="flex items-center justify-between">
                  <p class="text-xs font-medium tracking-wide text-(--ui-text-muted) uppercase">
                    {{ t('registry.card.person', { n: i + 1 }) }}
                  </p>
                  <UButton color="error" variant="link" size="xs" @click="() => { card?.contributors.splice(i, 1) }">
                    {{ t('registry.card.remove') }}
                  </UButton>
                </div>
                <div class="grid gap-3 sm:grid-cols-2">
                  <UFormField :label="t('registry.card.name')" required>
                    <UInput v-model="c.name" class="w-full" />
                  </UFormField>
                  <UFormField :label="t('registry.card.role')" required>
                    <USelect v-model="(c.role as ContributorRole)" :items="roleItems" class="w-full" />
                  </UFormField>
                </div>
                <div class="grid gap-3 sm:grid-cols-3">
                  <UFormField :label="t('registry.card.affiliation')">
                    <UInput v-model="c.affiliation" class="w-full" />
                  </UFormField>
                  <UFormField label="ORCID">
                    <UInput v-model="c.orcid" placeholder="0000-0000-0000-0000" class="w-full" />
                  </UFormField>
                  <UFormField :label="t('registry.card.email')">
                    <UInput v-model="c.email" type="email" class="w-full" />
                  </UFormField>
                </div>
              </div>
              <UButton color="neutral" variant="outline" icon="i-lucide-plus" @click="addContributor">
                {{ t('registry.card.addPerson') }}
              </UButton>
            </div>
            <div class="space-y-3">
              <p class="text-sm font-medium">
                {{ t('registry.card.literature') }}
              </p>
              <div v-for="(l, i) in card.literature" :key="i" class="space-y-3 rounded-lg border border-(--ui-border) p-4">
                <div class="flex items-center justify-between">
                  <p class="text-xs font-medium tracking-wide text-(--ui-text-muted) uppercase">
                    {{ t('registry.card.reference', { n: i + 1 }) }}
                  </p>
                  <UButton color="error" variant="link" size="xs" @click="() => { card?.literature.splice(i, 1) }">
                    {{ t('registry.card.remove') }}
                  </UButton>
                </div>
                <UFormField :label="t('registry.card.citation')" required>
                  <UInput v-model="l.citation" class="w-full" />
                </UFormField>
                <div class="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_6rem]">
                  <UFormField label="DOI">
                    <UInput v-model="l.doi" placeholder="10.xxxx/…" class="w-full" />
                  </UFormField>
                  <UFormField :label="t('registry.card.link')">
                    <UInput v-model="l.url" type="url" placeholder="https://" class="w-full" />
                  </UFormField>
                  <UFormField :label="t('registry.card.year')">
                    <UInput v-model.number="l.year" type="number" class="w-full" />
                  </UFormField>
                </div>
              </div>
              <UButton color="neutral" variant="outline" icon="i-lucide-plus" @click="addReference">
                {{ t('registry.card.addReference') }}
              </UButton>
            </div>
          </ModelCardSection>

          <ModelCardSection id="requirements" v-model:open="open.requirements" :title="t('registry.card.sections.requirements')" :summary="sections[5]?.summary">
            <div class="grid gap-3 sm:grid-cols-4">
              <UFormField :label="t('registry.card.cpu')">
                <UInput v-model.number="card.requirements.cpuCores" type="number" min="0" class="w-full" />
              </UFormField>
              <UFormField :label="t('registry.card.memory')">
                <UInput v-model.number="card.requirements.memoryGb" type="number" min="0" class="w-full" />
              </UFormField>
              <UFormField :label="t('registry.card.storage')">
                <UInput v-model.number="card.requirements.storageGb" type="number" min="0" class="w-full" />
              </UFormField>
              <UFormField :label="t('registry.card.runtime')" :help="card.requirements.runtimeSeconds ? `≈ ${Math.round(card.requirements.runtimeSeconds / 60)} min` : undefined">
                <UInput v-model.number="card.requirements.runtimeSeconds" type="number" min="0" class="w-full" />
              </UFormField>
            </div>
            <div class="grid gap-3 sm:grid-cols-2">
              <UFormField label="GPU">
                <USelect v-model="gpuMode" :items="gpuItems" class="w-full" />
              </UFormField>
              <UFormField v-if="gpuMode === 'model'" :label="t('registry.card.gpu.name')">
                <UInput v-model="gpuName" class="w-full" />
              </UFormField>
            </div>
            <UFormField :label="t('registry.card.software')" :help="t('registry.card.softwareHint')">
              <UInputTags v-model="software" :placeholder="t('registry.card.tagPlaceholder')" class="w-full" />
            </UFormField>
          </ModelCardSection>

          <ModelCardSection id="test" v-model:open="open.test" :title="t('registry.card.sections.test')" :summary="sections[6]?.summary">
            <p class="rounded-md bg-ufc-blue-50 px-4 py-3 text-sm">
              {{ t('registry.card.testIntro') }}
            </p>
            <div v-for="(c, i) in card.testCases" :key="i" class="space-y-3 rounded-lg border border-(--ui-border) p-4">
              <div class="flex items-center justify-between">
                <p class="text-xs font-medium tracking-wide text-(--ui-text-muted) uppercase">
                  {{ t('registry.card.testCase', { n: i + 1 }) }}
                </p>
                <UButton color="error" variant="link" size="xs" @click="() => { card?.testCases.splice(i, 1) }">
                  {{ t('registry.card.remove') }}
                </UButton>
              </div>
              <UFormField :label="t('registry.card.name')" required>
                <UInput v-model="c.name" class="w-full" />
              </UFormField>
              <UFormField>
                <template #label>
                  {{ t('registry.card.description') }} <LangTag :lang="editLang" />
                </template>
                <UTextarea v-model="c.description![editLang]" :rows="2" autoresize class="w-full" />
              </UFormField>
              <div class="grid gap-3 sm:grid-cols-2">
                <UFormField :label="t('registry.card.input')" required>
                  <UInput v-model="c.inputUrl" type="url" placeholder="https://" class="w-full" />
                </UFormField>
                <UFormField :label="t('registry.card.expected')" required>
                  <UInput v-model="c.expectedOutputUrl" type="url" placeholder="https://" class="w-full" />
                </UFormField>
              </div>
              <UFormField :label="t('registry.card.documentation')">
                <UInput v-model="c.documentationUrl" type="url" :placeholder="t('registry.card.optionalUrl')" class="w-full" />
              </UFormField>
              <div class="grid gap-3 sm:grid-cols-2">
                <UFormField :label="t('registry.card.inputSha')">
                  <UInput v-model="c.inputSha256" :placeholder="t('registry.card.shaPlaceholder')" class="w-full font-mono" />
                </UFormField>
                <UFormField :label="t('registry.card.outputSha')">
                  <UInput v-model="c.outputSha256" :placeholder="t('registry.card.shaPlaceholder')" class="w-full font-mono" />
                </UFormField>
              </div>
            </div>
            <UButton color="neutral" variant="outline" icon="i-lucide-plus" @click="addTestCase">
              {{ t('registry.card.addTestCase') }}
            </UButton>
          </ModelCardSection>

          <ModelCardSection id="io" v-model:open="open.io" :title="t('registry.card.sections.io')" :summary="sections[7]?.summary">
            <p class="rounded-md bg-ufc-blue-50 px-4 py-3 text-sm">
              {{ t('registry.card.ioIntro') }}
            </p>
            <p v-if="ioError" class="text-sm text-(--ui-text-muted)">
              {{ t('registry.card.ioUnavailable') }}
            </p>
            <div v-for="x in io" :key="`${x.kind}-${x.id}`" class="grid gap-3 border-t border-(--ui-border) pt-4 sm:grid-cols-[10rem_minmax(0,1fr)]">
              <div class="space-y-1">
                <p class="font-mono text-sm break-all">
                  {{ x.id }}
                </p>
                <UBadge :color="x.kind === 'input' ? 'info' : 'success'" variant="soft" size="sm">
                  {{ t(`registry.card.${x.kind}Kind`) }}
                </UBadge>
                <p class="text-xs text-(--ui-text-muted)">
                  {{ x.type }}
                </p>
              </div>
              <UFormField>
                <template #label>
                  {{ t('registry.card.note') }} <LangTag :lang="editLang" />
                </template>
                <UTextarea v-if="card.ioNotes[x.id]" v-model="card.ioNotes[x.id]![editLang]" :rows="2" autoresize class="w-full" />
              </UFormField>
            </div>
          </ModelCardSection>

          <ModelCardSection id="run" v-model:open="open.run" :title="t('registry.card.sections.run')" :summary="sections[8]?.summary">
            <!-- Read-only for now: UMP returns only anonymous-access of the run settings
                 but replaces all of them on save, so saving here would drop the others. -->
            <UFormField :label="t('registry.card.run.who')">
              <URadioGroup
                :model-value="model.anonymousAccess ? 'anyone' : 'signedIn'"
                :items="[{ label: t('registry.card.run.signedIn'), value: 'signedIn' }, { label: t('registry.card.run.anyone'), value: 'anyone' }]"
                disabled
              />
            </UFormField>
            <p class="text-xs text-(--ui-text-muted)">
              {{ t('registry.card.run.readOnly') }}
            </p>
          </ModelCardSection>
        </fieldset>

        <!-- Ready to submit? -->
        <aside class="space-y-4 rounded-lg bg-ufc-blue-50 p-5 lg:col-start-2 xl:sticky xl:top-4 xl:col-start-3">
          <h2 class="font-semibold">
            {{ submit ? t('registry.card.ready') : t(`registry.status.${model.status}`) }}
          </h2>
          <p v-if="!submit" class="text-sm text-(--ui-text-muted)">
            {{ t(`registry.explain.${model.status}`) }}
          </p>
          <template v-if="editable">
            <div class="space-y-2">
              <p class="text-xs text-(--ui-text-muted)">
                {{ t('registry.card.requiredHeading') }}
              </p>
              <p v-for="r in required" :key="r.key" class="flex items-center gap-2 text-sm">
                <UIcon :name="r.ok ? 'i-lucide-circle-check' : 'i-lucide-circle-alert'" class="size-4 shrink-0" :class="r.ok ? 'text-(--ui-success)' : 'text-(--ui-warning)'" />
                {{ r.label }}
              </p>
            </div>
            <div class="space-y-2">
              <p class="text-xs text-(--ui-text-muted)">
                {{ t('registry.card.speedsUp') }}
              </p>
              <p v-for="r in recommended" :key="r.key" class="flex items-center gap-2 text-sm">
                <UIcon :name="r.ok ? 'i-lucide-circle-check' : 'i-lucide-circle'" class="size-4 shrink-0" :class="r.ok ? 'text-(--ui-success)' : 'text-(--ui-text-dimmed)'" />
                {{ r.label }}
              </p>
            </div>
          </template>
          <UButton v-if="submit" block icon="i-lucide-send" :disabled="missing.length > 0" :loading="busy" @click="act('submitted')">
            {{ t(`registry.action.${stepKey(model.status, 'submitted')}`) }}
          </UButton>
          <p v-if="submit" class="text-xs text-(--ui-text-muted)" role="status">
            {{ missing.length ? t('registry.card.missing', { fields: missing.map(m => m.label).join(', ') }) : t('registry.card.submitHint') }}
          </p>
          <UButton v-if="editable" block color="neutral" variant="outline" icon="i-lucide-save" :loading="busy" @click="() => { save() }">
            {{ t('registry.card.saveDraft') }}
          </UButton>
          <p v-if="saved" class="text-center text-xs text-(--ui-text-muted)" role="status">
            {{ t('registry.card.saved') }}
          </p>
          <UButton
            v-for="a in otherActions"
            :key="a.to"
            block
            color="neutral"
            variant="outline"
            icon="i-lucide-undo-2"
            :loading="busy"
            @click="act(a.to)"
          >
            {{ t(`registry.action.${stepKey(model.status, a.to)}`) }}
          </UButton>
        </aside>
      </div>
    </template>
  </section>
</template>
