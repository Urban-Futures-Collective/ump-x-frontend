<script setup lang="ts">
import type { Job } from '~/types/ump'
import type { OgcJob } from '~/composables/useUmpJobs'
import type { RegistryStatus } from '~/types/registry'

// Reviewing one model (design V2): a checklist over the model card, the interface the
// server describes, the verification run, and the decision. Only the decision, its
// note and the run's job id are stored; the checklist is the reviewer's own aid.
// Four-eyes: nobody reviews their own model.
definePageMeta({ middleware: ['auth', 'prototype', 'verifier'] })
const { t, locale } = useI18n()
const route = useRoute()
const { byId, actorFor, transition, ownerLabel, isLive } = useRegistry()
const { base } = useUmpBase()
const toast = useToast()

const model = computed(() => byId(String(route.params.id)))
const actor = computed(() => model.value ? actorFor(model.value) : null)
const actions = computed(() => model.value && actor.value ? transitionsFor(model.value.status, actor.value) : [])
const processId = computed(() => model.value ? `${model.value.serverName}:${model.value.remoteProcessId}` : '')

const text = (f: 'fullName' | 'purpose' | 'limitationsRisks') =>
  model.value ? inLang(model.value[f], locale.value, model.value.defaultLang) : ''
const title = computed(() => text('fullName') || model.value?.remoteProcessId || '')

// Checklist: what the card says, one line per section. Ticks live only on this page.
const checks = ref<Record<string, boolean>>({})
const checklist = computed(() => {
  const m = model.value
  if (!m) return []
  const req = m.requirements
  const reqParts = [
    req.cpuCores ? t('registry.review.cpu', { n: req.cpuCores }) : '',
    req.memoryGb ? t('registry.review.memory', { n: req.memoryGb }) : '',
    req.runtimeSeconds ? t('registry.review.runtime', { n: Math.round(req.runtimeSeconds) }) : '',
  ].filter(Boolean)
  const others = (['de', 'en'] as const).filter(l => l !== m.defaultLang && m.fullName[l])
  return [
    { key: 'purpose', label: t('registry.review.purpose'), value: text('purpose') },
    { key: 'licence', label: t('registry.review.licence'), value: [m.license, m.repositoryUrl].filter(Boolean).join(' · ') },
    { key: 'limits', label: t('registry.review.limits'), value: text('limitationsRisks') },
    {
      key: 'people',
      label: t('registry.review.people'),
      value: [
        m.contributors.length ? t('registry.review.contributors', m.contributors.length) : '',
        ...m.literature.map(l => l.citation),
      ].filter(Boolean).join(' · '),
    },
    { key: 'requirements', label: t('registry.review.requirements'), value: reqParts.join(' · ') },
    {
      key: 'languages',
      label: t('registry.review.languages'),
      value: [t('registry.review.defaultLang', { lang: m.defaultLang.toUpperCase() }), ...others.map(l => l.toUpperCase())].join(' · '),
    },
  ]
})

// The interface as the server describes it right now (OGC process description).
// Verifiers see models under review in /processes, so this works before publishing.
const { data: process, error: processError } = useUmpProcess(processId)

// Verification run: the reviewer starts a run in a new tab and enters its job id
// here. The API accepts only a successful run of this model, started by the reviewer
// during this review; the check below catches the obvious mistakes first.
const jobId = ref('')
const job = ref<Job | null>(null)
const jobProblem = ref<string | null>(null)
const checking = ref(false)
watch(model, (m) => { if (m?.verificationJobId && !jobId.value) jobId.value = m.verificationJobId }, { immediate: true })

async function checkJob() {
  const id = jobId.value.trim()
  if (!id) return
  checking.value = true
  job.value = null
  jobProblem.value = null
  try {
    const found = toJob(await $fetch<OgcJob>(`${base}/jobs/${id}`))
    if (found.processId && found.processId !== processId.value) jobProblem.value = t('registry.review.jobOtherModel', { model: found.processId })
    else if (found.status !== 'successful') jobProblem.value = t('registry.review.jobNotDone', { status: found.status })
    job.value = found
  }
  catch (e) {
    jobProblem.value = apiErrorMessage(e)
  }
  finally {
    checking.value = false
  }
}
const jobReady = computed(() => !!job.value && !jobProblem.value)
const jobDuration = computed(() => {
  const j = job.value
  if (!j?.created || !j.finished) return ''
  const s = Math.round((new Date(j.finished).getTime() - new Date(j.created).getTime()) / 1000)
  return s >= 60 ? `${Math.floor(s / 60)} min ${s % 60} s` : `${s} s`
})

// Decision. Rejecting and deactivating need a reason the provider will see.
const busy = ref(false)
const pending = ref<RegistryStatus | null>(null)
const note = ref('')
async function step(to: RegistryStatus, text?: string) {
  busy.value = true
  try {
    await transition(model.value!.id, to, text, to === 'verified' && isLive ? jobId.value.trim() : undefined)
  }
  catch (e) {
    toast.add({ title: t('registry.failed'), description: apiErrorMessage(e), color: 'error' })
  }
  finally {
    busy.value = false
  }
}
function choose(a: { to: RegistryStatus, needsNote: boolean }) {
  if (a.needsNote) {
    pending.value = a.to
    note.value = ''
    return
  }
  step(a.to)
}
function confirm() {
  if (!pending.value || !note.value.trim()) return
  const to = pending.value
  pending.value = null
  step(to, note.value.trim())
}
// With the API, verifying needs a checked run; the sample data does without.
const blocked = (to: RegistryStatus) => to === 'verified' && isLive && !jobReady.value
const negative = (to: RegistryStatus) => to === 'rejected' || to === 'deactivated'
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
              {{ t('registry.review.title', { name: title }) }}
            </h1>
            <RegistryStatusBadge :status="model.status" />
          </div>
          <p class="text-sm text-(--ui-text-muted)">
            {{ processId }}<template v-if="model.versionLabel">
              · v{{ model.versionLabel }}
            </template> · {{ t('registry.review.owner', { name: ownerLabel(model) }) }}
          </p>
        </div>
        <UButton color="neutral" variant="outline" icon="i-lucide-file-text" :to="`/verify/${model.id}/card`">
          {{ t('registry.cardView.open') }}
        </UButton>
      </div>

      <UAlert
        v-if="actor?.isOwner"
        color="neutral"
        variant="subtle"
        icon="i-lucide-users"
        :description="t('registry.verify.ownModel')"
      />

      <div class="grid items-start gap-6 lg:grid-cols-2">
        <div class="space-y-6">
          <UCard>
            <template #header>
              <h2 class="font-semibold">
                {{ t('registry.review.card') }}
              </h2>
              <p class="text-xs text-(--ui-text-muted)">
                {{ t('registry.review.cardHint') }}
              </p>
            </template>
            <ul class="divide-y divide-(--ui-border)">
              <li v-for="c in checklist" :key="c.key" class="py-3 first:pt-0 last:pb-0">
                <UCheckbox
                  :model-value="!!checks[c.key]"
                  :label="c.label"
                  :description="c.value || t('registry.card.empty')"
                  @update:model-value="v => { checks[c.key] = !!v }"
                />
              </li>
            </ul>
          </UCard>

          <UCard>
            <template #header>
              <h2 class="font-semibold">
                {{ t('registry.review.decision') }}
              </h2>
              <p class="text-xs text-(--ui-text-muted)">
                {{ t(`registry.verifyExplain.${model.status}`) }}
              </p>
            </template>
            <div class="space-y-3">
              <p v-if="!actions.length" class="text-sm text-(--ui-text-muted)">
                {{ t('registry.review.noActions') }}
              </p>
              <div v-else class="flex flex-wrap gap-2">
                <UButton
                  v-for="a in actions"
                  :key="a.to"
                  :color="negative(a.to) ? 'neutral' : 'primary'"
                  :variant="negative(a.to) ? 'outline' : 'solid'"
                  :class="negative(a.to) ? 'sm:ml-auto' : ''"
                  :disabled="blocked(a.to)"
                  :loading="busy"
                  @click="choose(a)"
                >
                  {{ t(`registry.action.${a.to}`) }}
                </UButton>
              </div>
              <p v-if="actions.some(a => blocked(a.to))" class="text-xs text-(--ui-text-muted)">
                {{ t('registry.review.needsRun') }}
              </p>
              <p v-if="actions.some(a => a.to === 'published')" class="text-xs text-(--ui-text-muted)">
                {{ t('registry.verify.publishNote', { role: processId }) }}
              </p>

              <form v-if="pending" class="space-y-3 rounded-md border border-(--ui-border) p-3" @submit.prevent="confirm">
                <UFormField :label="t(`registry.noteLabel.${pending}`)" :description="t('registry.verify.noteVisible')" required>
                  <UTextarea v-model="note" :rows="3" autoresize class="w-full" autofocus />
                </UFormField>
                <div class="flex justify-end gap-2">
                  <UButton type="button" variant="ghost" color="neutral" @click="() => { pending = null }">
                    {{ t('registry.cancel') }}
                  </UButton>
                  <UButton type="submit" :disabled="!note.trim()" :loading="busy">
                    {{ t(`registry.action.${pending}`) }}
                  </UButton>
                </div>
              </form>
            </div>
          </UCard>
        </div>

        <div class="space-y-6">
          <UCard>
            <template #header>
              <h2 class="font-semibold">
                {{ t('registry.review.interface') }}
              </h2>
            </template>
            <p v-if="processError" class="text-sm text-(--ui-text-muted)">
              {{ t('registry.review.interfaceMissing') }}
            </p>
            <template v-else-if="process">
              <table class="w-full text-left text-sm">
                <thead class="text-xs text-(--ui-text-muted)">
                  <tr>
                    <th scope="col" class="py-1 font-medium">
                      {{ t('registry.review.io') }}
                    </th>
                    <th scope="col" class="py-1 font-medium">
                      {{ t('registry.facts.inputType') }}
                    </th>
                    <th scope="col" class="py-1 font-medium">
                      {{ t('registry.facts.inputRequired') }}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="i in process.inputs" :key="i.name" class="border-t border-(--ui-border)">
                    <td class="py-1.5">
                      {{ i.name }}
                    </td>
                    <td class="py-1.5">
                      {{ i.type }}
                    </td>
                    <td class="py-1.5">
                      {{ i.required ? t('registry.yes') : t('registry.no') }}
                    </td>
                  </tr>
                  <tr v-for="o in process.outputs" :key="o.name" class="border-t border-(--ui-border)">
                    <td class="py-1.5">
                      → {{ o.name }}
                    </td>
                    <td class="py-1.5">
                      {{ o.mediaType || o.format || '' }}
                    </td>
                    <td class="py-1.5">
                      {{ t('registry.review.output') }}
                    </td>
                  </tr>
                </tbody>
              </table>
              <p class="mt-3 text-xs text-(--ui-text-muted)">
                {{ t('registry.review.pinned') }}
              </p>
            </template>
          </UCard>

          <UCard>
            <template #header>
              <div class="flex items-center justify-between gap-3">
                <h2 class="font-semibold">
                  {{ t('registry.review.run') }}
                </h2>
                <!-- The run form in a new tab, so this page stays open for the
                     decision. Reviewers may run models under review (F12, D7). -->
                <UButton
                  icon="i-lucide-play"
                  variant="outline"
                  :disabled="!isLive"
                  :to="isLive ? `/run?process=${encodeURIComponent(processId)}` : undefined"
                  target="_blank"
                >
                  {{ t('registry.review.runStart') }}
                </UButton>
              </div>
            </template>
            <div class="space-y-3 text-sm">
              <p v-if="model.testCases.length">
                {{ t('registry.review.testCase', { name: model.testCases[0]!.name }) }}
                <ULink :to="model.testCases[0]!.inputUrl" external target="_blank" class="text-(--ui-primary)">
                  {{ t('registry.review.input') }}
                </ULink>
                ·
                <ULink :to="model.testCases[0]!.expectedOutputUrl" external target="_blank" class="text-(--ui-primary)">
                  {{ t('registry.review.expected') }}
                </ULink>
              </p>
              <p v-else class="text-(--ui-text-muted)">
                {{ t('registry.review.noTestCase') }}
              </p>

              <form v-if="isLive" class="flex flex-wrap items-end gap-2" @submit.prevent="checkJob">
                <UFormField :label="t('registry.verify.jobId')" :description="t('registry.verify.jobIdHint')" class="min-w-0 flex-1">
                  <UInput v-model="jobId" class="w-full" />
                </UFormField>
                <UButton type="submit" variant="outline" :disabled="!jobId.trim()" :loading="checking">
                  {{ t('registry.review.check') }}
                </UButton>
              </form>
              <p v-else class="text-xs text-(--ui-text-muted)">
                {{ t('registry.verify.testRunNote') }}
              </p>

              <p v-if="jobProblem" class="rounded-md bg-(--ui-error)/10 px-3 py-2 text-(--ui-error)" role="alert">
                {{ jobProblem }}
              </p>
              <p v-else-if="job" class="rounded-md bg-(--ui-success)/10 px-3 py-2 text-(--ui-success)">
                ✓ {{ t('registry.review.jobOk', { id: job.id.slice(0, 8) }) }}<template v-if="jobDuration">
                  · {{ jobDuration }}
                </template>
              </p>
              <p v-if="model.verificationJobId" class="text-xs text-(--ui-text-muted)">
                {{ t('registry.review.linked', { id: model.verificationJobId.slice(0, 8) }) }}
              </p>
            </div>
          </UCard>
        </div>
      </div>
    </template>
  </section>
</template>
