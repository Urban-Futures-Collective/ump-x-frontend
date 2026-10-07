<script setup lang="ts">
import type { LangMap } from '~/types/registry'

// One of the provider's models: the model card (what OGC does not describe), the review
// status with the reviewer's comment, and submitting or withdrawing.
// Prototype with sample data (see useRegistryPrototype).
definePageMeta({ middleware: ['auth', 'prototype', 'provider'] })
const { t, locale } = useI18n()
const route = useRoute()
const { byId, actorFor, transition, updateCard } = useRegistryPrototype()

const model = computed(() => byId(String(route.params.id)))
const actor = computed(() => model.value ? actorFor(model.value) : null)
const editable = computed(() => !!model.value && !!actor.value && canEditCard(model.value.status, actor.value))
const actions = computed(() => model.value && actor.value ? transitionsFor(model.value.status, actor.value) : [])

// The card as a copy, saved explicitly, so a walkthrough can show unsaved changes.
type Card = { defaultLang: 'de' | 'en', fullName: LangMap, shortDescription: LangMap, purpose: LangMap, limitationsRisks: LangMap, license: string, repositoryUrl: string, versionLabel: string }
function cardOf(): Card {
  const m = model.value!
  return {
    defaultLang: m.defaultLang,
    fullName: { ...m.fullName },
    shortDescription: { ...m.shortDescription },
    purpose: { ...m.purpose },
    limitationsRisks: { ...m.limitationsRisks },
    license: m.license,
    repositoryUrl: m.repositoryUrl,
    versionLabel: m.versionLabel,
  }
}
const card = ref<Card | null>(model.value ? cardOf() : null)
const saved = ref(false)
watch(card, () => { saved.value = false }, { deep: true })

const LANG_FIELDS = ['fullName', 'shortDescription', 'purpose', 'limitationsRisks'] as const
// What F12 requires before submitting: every card text in the default language, plus a
// licence.
const missing = computed(() => {
  const c = card.value
  if (!c) return []
  const gaps: string[] = LANG_FIELDS.filter(f => !c[f][c.defaultLang]?.trim()).map(f => t(`registry.card.${f}`))
  if (!c.license.trim()) gaps.push(t('registry.card.license'))
  return gaps
})

function save() {
  if (!model.value || !card.value) return
  updateCard(model.value.id, structuredClone(toRaw(card.value)))
  saved.value = true
}

function act(to: (typeof actions.value)[number]['to']) {
  if (!model.value) return
  if (to === 'submitted') save()
  transition(model.value.id, to)
}

const langItems = [{ label: 'Deutsch', value: 'de' }, { label: 'English', value: 'en' }]
const title = computed(() => model.value ? inLang(model.value.fullName, locale.value, model.value.defaultLang) || model.value.remoteProcessId : '')
</script>

<template>
  <section class="max-w-5xl space-y-6">
    <PrototypeNotice />

    <ULink to="/contribute" class="flex items-center gap-1 text-sm text-(--ui-text-muted) hover:text-(--ui-text)">
      <UIcon name="i-lucide-arrow-left" aria-hidden="true" />
      {{ t('registry.contribute.title') }}
    </ULink>

    <p v-if="!model" class="text-(--ui-text-muted)">
      {{ t('registry.notFound') }}
    </p>

    <template v-else-if="card">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h1 class="text-2xl font-semibold text-ufc-slate-900">
          {{ title }}
        </h1>
        <RegistryStatusBadge :status="model.status" />
      </div>

      <UAlert
        v-if="model.statusNote && (model.status === 'changes_requested' || model.status === 'rejected' || model.status === 'deactivated')"
        :color="model.status === 'changes_requested' ? 'warning' : 'error'"
        variant="subtle"
        icon="i-lucide-message-square"
        :title="t(`registry.noteTitle.${model.status}`)"
        :description="model.statusNote"
      />
      <p class="text-sm text-(--ui-text-muted)">
        {{ t(`registry.explain.${model.status}`) }}
      </p>

      <UCard>
        <template #header>
          <h2 class="font-semibold">
            {{ t('registry.card.title') }}
          </h2>
          <p class="text-sm text-(--ui-text-muted)">
            {{ t('registry.card.why') }}
          </p>
        </template>
        <fieldset :disabled="!editable" class="space-y-4">
          <legend class="sr-only">
            {{ t('registry.card.title') }}
          </legend>
          <UFormField :label="t('registry.card.defaultLang')" :description="t('registry.card.defaultLangHint')">
            <USelect v-model="card.defaultLang" :items="langItems" class="w-48" />
          </UFormField>
          <div v-for="f in LANG_FIELDS" :key="f" class="space-y-2">
            <p class="text-sm font-medium">
              {{ t(`registry.card.${f}`) }}
            </p>
            <div class="grid gap-3 sm:grid-cols-2">
              <UFormField v-for="lang in (['de', 'en'] as const)" :key="lang" :label="lang === 'de' ? 'Deutsch' : 'English'" :required="lang === card.defaultLang">
                <UInput v-if="f === 'fullName'" v-model="card[f][lang]" class="w-full" />
                <UTextarea v-else v-model="card[f][lang]" :rows="2" autoresize class="w-full" />
              </UFormField>
            </div>
          </div>
          <div class="grid gap-4 sm:grid-cols-3">
            <UFormField :label="t('registry.card.license')" :hint="t('registry.card.licenseHint')" required>
              <UInput v-model="card.license" placeholder="MIT" class="w-full" />
            </UFormField>
            <UFormField :label="t('registry.card.version')">
              <UInput v-model="card.versionLabel" class="w-full" />
            </UFormField>
            <UFormField :label="t('registry.card.repository')">
              <UInput v-model="card.repositoryUrl" type="url" placeholder="https://" class="w-full" />
            </UFormField>
          </div>
        </fieldset>
        <template v-if="editable" #footer>
          <div class="flex flex-wrap items-center justify-between gap-3">
            <p class="text-xs" :class="missing.length ? 'text-(--ui-warning)' : 'text-(--ui-text-muted)'" role="status">
              {{ missing.length ? t('registry.card.missing', { fields: missing.join(', ') }) : t('registry.card.complete') }}
            </p>
            <div class="flex items-center gap-2">
              <span v-if="saved" class="text-xs text-(--ui-text-muted)" role="status">{{ t('registry.card.saved') }}</span>
              <UButton variant="outline" icon="i-lucide-save" @click="save">
                {{ t('registry.card.save') }}
              </UButton>
            </div>
          </div>
        </template>
      </UCard>

      <div v-if="actions.length" class="flex flex-wrap gap-2">
        <UButton
          v-for="a in actions"
          :key="a.to"
          :icon="a.to === 'submitted' ? 'i-lucide-send' : 'i-lucide-undo-2'"
          :variant="a.to === 'submitted' ? 'solid' : 'outline'"
          :disabled="a.to === 'submitted' && missing.length > 0"
          @click="act(a.to)"
        >
          {{ t(`registry.action.${a.to}`) }}
        </UButton>
      </div>

      <RegistryModelFacts :model="model" />
    </template>
  </section>
</template>
