<script setup lang="ts">
import type { ModelInterface, RegistryStatus } from '~/types/registry'
import type { InterfaceChangeRow } from '~/utils/interfaceChanges'

// An interface change (design V3): what the model was verified against next to what its
// server describes now, and the three ways out: verify again against the new interface
// (after a fresh run), send the model back to review, or take it offline. UMP only flags
// a change and keeps the model running (policy A), so until a verifier decides, runs
// with the old inputs may fail.
definePageMeta({ middleware: ['auth', 'prototype', 'verifier'] })
const { t, locale } = useI18n()
const route = useRoute()
const { byId, actorFor, transition, reverify, modelInterface, ownerLabel, isLive } = useRegistry()
const toast = useToast()

const model = computed(() => byId(String(route.params.id)))
const actor = computed(() => model.value ? actorFor(model.value) : null)
const processId = computed(() => model.value ? `${model.value.serverName}:${model.value.remoteProcessId}` : '')
const title = computed(() => model.value ? inLang(model.value.fullName, locale.value, model.value.defaultLang) || model.value.remoteProcessId : '')
usePageCrumb(() => title.value)
const date = (iso?: string) => iso ? new Date(iso).toLocaleDateString(locale.value, { dateStyle: 'medium' }) : ''

// The comparison is fetched live from the model server through UMP on every load.
const view = ref<ModelInterface | null>(null)
const viewError = ref<string | null>(null)
const loadingView = ref(false)
async function loadView() {
  if (!model.value) return
  loadingView.value = true
  viewError.value = null
  try {
    view.value = await modelInterface(model.value.id)
  }
  catch (e) {
    viewError.value = apiErrorMessage(e)
  }
  finally {
    loadingView.value = false
  }
}
watch(() => model.value?.id, (id) => { if (id) loadView() }, { immediate: true })

const state = computed(() => view.value?.state ?? model.value?.interfaceState ?? 'unchecked')
const comparison = computed(() => {
  const v = view.value
  if (!v?.diff || !v.verified || !v.live) return null
  return compareInterfaces(v.verified, v.live, v.diff, { required: t('registry.drift.required'), optional: t('registry.drift.optional') })
})
const kindColor = { added: 'primary', changed: 'warning', removed: 'error' } as const
const rowName = (r: InterfaceChangeRow) => r.output ? `→ ${r.name}` : r.name
const modeLabel = (key: string) => t(`registry.drift.mode.${key}`)

// Re-verifying is for verifiers other than the owner, on verified or published models,
// and needs the server to answer: UMP pins what it fetches now.
const status = computed(() => model.value?.status)
const canReverify = computed(() => !!actor.value && actor.value.isVerifier && !actor.value.isOwner
  && (status.value === 'verified' || status.value === 'published'))
const steps = computed(() => model.value && actor.value ? transitionsFor(model.value.status, actor.value) : [])
const canReset = computed(() => steps.value.some(s => s.to === 'in_review'))
const canDeactivate = computed(() => steps.value.some(s => s.to === 'deactivated'))

const { jobId, job, jobProblem, checking, checkJob, jobReady, jobDuration } = useVerificationRun(processId)
const reverifyBlocked = computed(() => !view.value?.live || (isLive && !jobReady.value))

const busy = ref(false)
async function doReverify() {
  if (!model.value) return
  busy.value = true
  try {
    await reverify(model.value.id, isLive ? jobId.value.trim() : undefined)
    toast.add({ title: t('registry.drift.done'), color: 'success' })
    await loadView()
  }
  catch (e) {
    toast.add({ title: t('registry.failed'), description: apiErrorMessage(e), color: 'error' })
  }
  finally {
    busy.value = false
  }
}

// Back to review and deactivating need a reason the owner will see.
const pending = ref<RegistryStatus | null>(null)
const note = ref('')
function ask(to: RegistryStatus) {
  pending.value = to
  note.value = ''
}
async function confirm() {
  if (!model.value || !pending.value || !note.value.trim()) return
  const to = pending.value
  busy.value = true
  try {
    await transition(model.value.id, to, note.value.trim())
    pending.value = null
    await navigateTo(to === 'in_review' ? `/verify/${model.value.id}` : '/verify')
  }
  catch (e) {
    toast.add({ title: t('registry.failed'), description: apiErrorMessage(e), color: 'error' })
  }
  finally {
    busy.value = false
  }
}
</script>

<template>
  <section class="mx-auto max-w-6xl space-y-6">
    <PrototypeNotice />

    <p v-if="!model" class="text-(--ui-text-muted)">
      {{ t('registry.notFound') }}
    </p>

    <template v-else>
      <div class="space-y-2">
        <h1 class="text-2xl font-semibold text-ufc-slate-900">
          {{ t(state === 'unreachable' ? 'registry.drift.titleUnreachable' : 'registry.drift.title', { name: title }) }}
        </h1>
        <div class="flex flex-wrap items-center gap-2 text-sm text-(--ui-text-muted)">
          <RegistryStatusBadge :status="model.status" />
          <UBadge v-if="state === 'drifted' || state === 'unreachable'" color="warning" variant="subtle" size="sm">
            {{ t(`registry.drift.badge.${state}`) }}
          </UBadge>
          <span>
            {{ processId }} · {{ t('registry.review.owner', { name: ownerLabel(model) }) }}<template v-if="view?.lastCheckedAt">
              · {{ t('registry.drift.checked', { date: date(view.lastCheckedAt) }) }}
            </template>
          </span>
        </div>
      </div>

      <UAlert v-if="actor?.isOwner" color="neutral" variant="subtle" icon="i-lucide-users" :description="t('registry.verify.ownModel')" />

      <div
        v-if="state === 'drifted'"
        class="rounded-lg border border-(--ui-warning)/50 bg-(--ui-warning)/5 px-4 py-3 text-sm"
        role="status"
      >
        {{ t(model.status === 'published' ? 'registry.drift.warnPublished' : 'registry.drift.warnVerified') }}
      </div>
      <div v-else-if="state === 'unreachable'" class="rounded-lg border border-(--ui-warning)/50 bg-(--ui-warning)/5 px-4 py-3 text-sm" role="status">
        {{ t('registry.drift.warnUnreachable') }}
      </div>
      <UAlert
        v-else-if="view"
        color="success"
        variant="subtle"
        icon="i-lucide-circle-check"
        :title="t('registry.drift.inSync')"
        :actions="[{ label: t('registry.drift.back'), color: 'neutral', variant: 'outline', to: '/verify' }]"
      />

      <UAlert v-if="viewError" color="error" variant="subtle" icon="i-lucide-circle-alert" :title="t('registry.drift.loadFailed')" :description="viewError" />

      <template v-if="view">
        <p v-if="view.liveError" class="text-sm text-(--ui-text-muted)">
          {{ t('registry.drift.liveError', { error: view.liveError }) }}
        </p>
        <p v-else-if="!view.verified" class="text-sm text-(--ui-text-muted)">
          {{ t('registry.drift.neverVerified') }}
        </p>

        <div v-if="comparison" class="space-y-2">
          <div class="overflow-x-auto rounded-lg border border-(--ui-border) bg-white">
            <table class="w-full min-w-[36rem] text-left text-sm">
              <thead class="text-xs text-(--ui-text-muted)">
                <tr>
                  <th scope="col" class="px-4 py-3 font-medium">
                    {{ t('registry.drift.col.change') }}
                  </th>
                  <th scope="col" class="px-4 py-3 font-medium">
                    {{ t('registry.drift.col.name') }}
                  </th>
                  <th scope="col" class="px-4 py-3 font-medium">
                    {{ view.verifiedAt ? t('registry.drift.col.verifiedOn', { date: date(view.verifiedAt) }) : t('registry.drift.col.verified') }}
                  </th>
                  <th scope="col" class="px-4 py-3 font-medium">
                    {{ t('registry.drift.col.now') }}
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="r in comparison.rows" :key="`${r.output}-${r.name}`" class="border-t border-(--ui-border)">
                  <td class="px-4 py-3">
                    <UBadge :color="kindColor[r.kind]" variant="subtle" size="sm">
                      {{ t(`registry.drift.kind.${r.kind}`) }}
                    </UBadge>
                  </td>
                  <td class="px-4 py-3 font-medium break-words">
                    {{ rowName(r) }}
                  </td>
                  <td class="px-4 py-3 text-(--ui-text-muted)">
                    {{ r.before || '–' }}
                  </td>
                  <td class="px-4 py-3" :class="r.kind === 'removed' ? 'text-(--ui-text-muted)' : 'font-medium'">
                    {{ r.after || '–' }}
                  </td>
                </tr>
                <tr v-for="m in comparison.modes" :key="m.key" class="border-t border-(--ui-border)">
                  <td class="px-4 py-3">
                    <UBadge color="warning" variant="subtle" size="sm">
                      {{ t('registry.drift.kind.changed') }}
                    </UBadge>
                  </td>
                  <td class="px-4 py-3 font-medium">
                    {{ modeLabel(m.key) }}
                  </td>
                  <td class="px-4 py-3 text-(--ui-text-muted)">
                    {{ m.before || '–' }}
                  </td>
                  <td class="px-4 py-3 font-medium">
                    {{ m.after || '–' }}
                  </td>
                </tr>
                <tr v-if="comparison.unchanged.length" class="border-t border-(--ui-border)">
                  <td class="px-4 py-3">
                    <UBadge color="neutral" variant="subtle" size="sm">
                      {{ t('registry.drift.kind.unchanged') }}
                    </UBadge>
                  </td>
                  <td class="px-4 py-3 break-words">
                    {{ comparison.unchanged.join(', ') }}
                  </td>
                  <td class="px-4 py-3 text-(--ui-text-muted)">
                    {{ t('registry.drift.unchanged', comparison.unchanged.length) }}
                  </td>
                  <td class="px-4 py-3 text-(--ui-text-muted)">
                    {{ t('registry.drift.unchanged', comparison.unchanged.length) }}
                  </td>
                </tr>
                <tr v-if="!comparison.rows.length && !comparison.modes.length" class="border-t border-(--ui-border)">
                  <td colspan="4" class="px-4 py-3 text-(--ui-text-muted)">
                    {{ t('registry.drift.noDifference') }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p class="text-xs text-(--ui-text-muted)">
            {{ t('registry.drift.ignored') }}
          </p>
        </div>
      </template>
      <p v-else-if="loadingView" class="text-sm text-(--ui-text-muted)">
        {{ t('registry.loading') }}
      </p>

      <div v-if="state === 'drifted' || state === 'unreachable'" class="grid items-start gap-4 md:grid-cols-3">
        <UCard>
          <h2 class="font-semibold">
            {{ t('registry.drift.accept.title') }}
          </h2>
          <p class="mt-1 text-sm text-(--ui-text-muted)">
            {{ t(model.status === 'published' ? 'registry.drift.accept.textPublished' : 'registry.drift.accept.textVerified') }}
          </p>
          <div v-if="canReverify" class="mt-4 space-y-3">
            <template v-if="isLive">
              <UButton
                icon="i-lucide-play"
                variant="outline"
                size="sm"
                :to="`/run?process=${encodeURIComponent(processId)}`"
                target="_blank"
              >
                {{ t('registry.review.runStart') }}
              </UButton>
              <form class="space-y-2" @submit.prevent="checkJob">
                <UFormField :label="t('registry.verify.jobId')" :description="t('registry.drift.accept.runHint')">
                  <div class="flex gap-2">
                    <UInput v-model="jobId" class="min-w-0 flex-1" />
                    <UButton type="submit" variant="outline" :disabled="!jobId.trim()" :loading="checking">
                      {{ t('registry.review.check') }}
                    </UButton>
                  </div>
                </UFormField>
              </form>
              <p v-if="jobProblem" class="rounded-md bg-(--ui-error)/10 px-3 py-2 text-sm text-(--ui-error)" role="alert">
                {{ jobProblem }}
              </p>
              <p v-else-if="job" class="rounded-md bg-(--ui-success)/10 px-3 py-2 text-sm text-(--ui-success)">
                ✓ {{ t('registry.review.jobOk', { id: job.id.slice(0, 8) }) }}<template v-if="jobDuration">
                  · {{ jobDuration }}
                </template>
              </p>
            </template>
            <UButton :disabled="reverifyBlocked" :loading="busy" @click="doReverify">
              {{ t('registry.drift.accept.button') }}
            </UButton>
            <p v-if="!view?.live" class="text-xs text-(--ui-text-muted)">
              {{ t('registry.drift.accept.needsServer') }}
            </p>
          </div>
        </UCard>

        <UCard v-if="canReset">
          <h2 class="font-semibold">
            {{ t('registry.drift.review.title') }}
          </h2>
          <p class="mt-1 text-sm text-(--ui-text-muted)">
            {{ t('registry.drift.review.text') }}
          </p>
          <UButton class="mt-4" color="neutral" variant="outline" :disabled="busy" @click="ask('in_review')">
            {{ t('registry.drift.review.button') }}
          </UButton>
        </UCard>

        <UCard v-if="canDeactivate">
          <h2 class="font-semibold">
            {{ t('registry.drift.offline.title') }}
          </h2>
          <p class="mt-1 text-sm text-(--ui-text-muted)">
            {{ t('registry.drift.offline.text') }}
          </p>
          <UButton class="mt-4" color="neutral" variant="outline" :disabled="busy" @click="ask('deactivated')">
            {{ t('registry.action.deactivated') }}
          </UButton>
        </UCard>
      </div>

      <form v-if="pending" class="space-y-3 rounded-lg border border-(--ui-border) bg-white p-4" @submit.prevent="confirm">
        <UFormField :label="t(`registry.noteLabel.${pending}`)" :description="t('registry.verify.noteVisible')" required>
          <UTextarea v-model="note" :rows="3" autoresize class="w-full" autofocus />
        </UFormField>
        <div class="flex justify-end gap-2">
          <UButton type="button" variant="ghost" color="neutral" @click="() => { pending = null }">
            {{ t('registry.cancel') }}
          </UButton>
          <UButton type="submit" :disabled="!note.trim()" :loading="busy">
            {{ pending === 'in_review' ? t('registry.drift.review.button') : t('registry.action.deactivated') }}
          </UButton>
        </div>
      </form>
    </template>
  </section>
</template>
