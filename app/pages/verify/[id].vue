<script setup lang="ts">
import type { RegistryStatus } from '~/types/registry'

// Reviewing one model: the model card as submitted, interface and history, and the
// decisions the workflow allows (see registryWorkflow.ts). Four-eyes: nobody reviews
// their own model. Prototype with sample data.
definePageMeta({ middleware: ['auth', 'prototype', 'verifier'] })
const { t, locale } = useI18n()
const route = useRoute()
const { byId, actorFor, transition, ownerLabel } = useRegistryPrototype()

const model = computed(() => byId(String(route.params.id)))
const actor = computed(() => model.value ? actorFor(model.value) : null)
const actions = computed(() => model.value && actor.value ? transitionsFor(model.value.status, actor.value) : [])

const text = (f: 'fullName' | 'shortDescription' | 'purpose' | 'limitationsRisks') =>
  model.value ? inLang(model.value[f], locale.value, model.value.defaultLang) : ''

// Decisions that need a reason open a small form first.
const pending = ref<RegistryStatus | null>(null)
const note = ref('')
function choose(a: { to: RegistryStatus, needsNote: boolean }) {
  if (a.needsNote) {
    pending.value = a.to
    note.value = ''
    return
  }
  transition(model.value!.id, a.to)
}
function confirm() {
  if (!pending.value || !note.value.trim()) return
  transition(model.value!.id, pending.value, note.value.trim())
  pending.value = null
}

const ICONS: Partial<Record<RegistryStatus, string>> = {
  in_review: 'i-lucide-eye',
  verified: 'i-lucide-badge-check',
  published: 'i-lucide-globe',
  changes_requested: 'i-lucide-message-square',
  rejected: 'i-lucide-x',
  deactivated: 'i-lucide-power',
}
</script>

<template>
  <section class="max-w-5xl space-y-6">
    <PrototypeNotice />

    <ULink to="/verify" class="flex items-center gap-1 text-sm text-(--ui-text-muted) hover:text-(--ui-text)">
      <UIcon name="i-lucide-arrow-left" aria-hidden="true" />
      {{ t('registry.verify.title') }}
    </ULink>

    <p v-if="!model" class="text-(--ui-text-muted)">
      {{ t('registry.notFound') }}
    </p>

    <template v-else>
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 class="text-2xl font-semibold text-ufc-slate-900">
            {{ text('fullName') || model.remoteProcessId }}
          </h1>
          <p class="text-sm text-(--ui-text-muted)">
            {{ t('registry.by', { name: ownerLabel(model) }) }}
          </p>
        </div>
        <RegistryStatusBadge :status="model.status" />
      </div>

      <UAlert
        v-if="actor?.isOwner"
        color="neutral"
        variant="subtle"
        icon="i-lucide-users"
        :description="t('registry.verify.ownModel')"
      />

      <UCard>
        <template #header>
          <h2 class="font-semibold">
            {{ t('registry.card.title') }}
          </h2>
        </template>
        <dl class="space-y-3 text-sm">
          <div v-for="f in (['shortDescription', 'purpose', 'limitationsRisks'] as const)" :key="f">
            <dt class="font-medium">
              {{ t(`registry.card.${f}`) }}
            </dt>
            <dd class="text-(--ui-text-muted)">
              {{ text(f) || t('registry.card.empty') }}
            </dd>
          </div>
          <div class="flex flex-wrap gap-x-8 gap-y-2">
            <div>
              <dt class="font-medium">
                {{ t('registry.card.license') }}
              </dt>
              <dd class="text-(--ui-text-muted)">
                {{ model.license || t('registry.card.empty') }}
              </dd>
            </div>
            <div>
              <dt class="font-medium">
                {{ t('registry.card.version') }}
              </dt>
              <dd class="text-(--ui-text-muted)">
                {{ model.versionLabel }}
              </dd>
            </div>
            <div v-if="model.repositoryUrl">
              <dt class="font-medium">
                {{ t('registry.card.repository') }}
              </dt>
              <dd>
                <ULink :to="model.repositoryUrl" external target="_blank" class="text-(--ui-primary)">
                  {{ model.repositoryUrl }}
                </ULink>
              </dd>
            </div>
          </div>
        </dl>
      </UCard>

      <UCard>
        <template #header>
          <h2 class="font-semibold">
            {{ t('registry.verify.decide') }}
          </h2>
          <p class="text-sm text-(--ui-text-muted)">
            {{ t(`registry.verifyExplain.${model.status}`) }}
          </p>
        </template>
        <div class="space-y-4">
          <div class="flex flex-wrap gap-2">
            <UButton icon="i-lucide-play" variant="outline" disabled>
              {{ t('registry.verify.testRun') }}
            </UButton>
            <UButton
              v-for="a in actions"
              :key="a.to"
              :icon="ICONS[a.to]"
              :color="a.to === 'rejected' || a.to === 'deactivated' ? 'error' : a.to === 'changes_requested' ? 'warning' : 'primary'"
              :variant="a.to === 'verified' || a.to === 'published' || a.to === 'in_review' ? 'solid' : 'outline'"
              @click="choose(a)"
            >
              {{ t(`registry.action.${a.to}`) }}
            </UButton>
          </div>
          <p class="text-xs text-(--ui-text-muted)">
            {{ t('registry.verify.testRunNote') }}
            <template v-if="actions.some(a => a.to === 'published')">
              {{ t('registry.verify.publishNote', { role: `${model.serverName}:${model.remoteProcessId}` }) }}
            </template>
          </p>

          <form v-if="pending" class="space-y-3 rounded-md border border-(--ui-border) p-3" @submit.prevent="confirm">
            <UFormField :label="t(`registry.noteLabel.${pending}`)" :description="t('registry.verify.noteVisible')" required>
              <UTextarea v-model="note" :rows="3" autoresize class="w-full" autofocus />
            </UFormField>
            <div class="flex justify-end gap-2">
              <UButton type="button" variant="ghost" color="neutral" @click="() => { pending = null }">
                {{ t('registry.cancel') }}
              </UButton>
              <UButton type="submit" :disabled="!note.trim()">
                {{ t(`registry.action.${pending}`) }}
              </UButton>
            </div>
          </form>
        </div>
      </UCard>

      <RegistryModelFacts :model="model" />
    </template>
  </section>
</template>
