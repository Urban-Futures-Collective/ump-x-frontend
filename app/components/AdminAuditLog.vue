<script setup lang="ts">
import type { ApiAuditEvent } from '~/utils/auditLog'

// Audit log (#111, item 13), a tab of the admin page (design A1): every registry change
// and run, newest first. UMP keeps three months. People are only known by their account
// id; the list names yourself and the owners of models it knows, everyone else by a
// short id.
const { t, te, locale } = useI18n()
const { umpBase } = useRuntimeConfig().public
const base = `${umpBase}/registry/v1`

const action = ref<string | undefined>(undefined)
const actionItems = computed<{ label: string, value: string | undefined }[]>(() => [
  { label: t('audit.allActions'), value: undefined },
  ...AUDIT_ACTIONS.map(a => ({ label: t(actionKey(a)), value: a })),
])

const events = ref<ApiAuditEvent[]>([])
const cursor = ref<string | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)

async function load(more = false) {
  loading.value = true
  error.value = null
  try {
    const page = await $fetch<{ events: ApiAuditEvent[], next_cursor: string | null }>(`${base}/audit`, {
      query: { limit: 50, ...(action.value ? { action: action.value } : {}), ...(more && cursor.value ? { cursor: cursor.value } : {}) },
    })
    events.value = more ? [...events.value, ...page.events] : page.events
    cursor.value = page.next_cursor
  }
  catch (e) {
    error.value = apiErrorMessage(e)
  }
  finally {
    loading.value = false
  }
}
onMounted(() => load())
watch(action, () => load())

// Names the page can give: the caller, and model owners from the cards.
const mySub = ref('')
onMounted(async () => {
  try {
    mySub.value = (await $fetch<{ sub: string }>(`${base}/me`)).sub
  }
  catch {
    // Without /me the own entries show the short id like everyone else's.
  }
})
const { cards } = useCommonsCards()
const models = computed(() => new Map([...cards.value.values()].map(c => [c.id, c])))
const owners = computed(() => new Map([...cards.value.values()].map(c => [c.ownerSub, c.ownerName])))

function actorOf(sub: string | null) {
  if (!sub) return t('audit.system')
  if (sub === mySub.value) return t('audit.you')
  return owners.value.get(sub) || t('audit.account', { id: sub.slice(0, 8) })
}
function modelOf(id: string | null) {
  if (!id) return null
  const c = models.value.get(id)
  const name = c ? c.fullName[c.defaultLang] || c.remoteProcessId : ''
  return { name: name || t('audit.model', { id: id.slice(0, 8) }), to: c?.status === 'published' ? `/commons/${c.serverName}:${c.remoteProcessId}` : undefined }
}
// Card fields as UMP names them, to the labels of the card form.
const FIELD_KEYS: Record<string, string> = { version_label: 'version', repository_url: 'repository' }
const fieldLabel = (f: string) => {
  const key = `registry.card.${FIELD_KEYS[f] ?? f.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())}`
  const label = t(key)
  return label === key ? f : label
}
</script>

<template>
  <section class="max-w-4xl space-y-4">
    <div class="flex flex-wrap items-center justify-between gap-4">
      <p class="text-sm text-(--ui-text-muted)">
        {{ t('audit.intro') }}
      </p>
      <USelectMenu v-model="action" :items="actionItems" value-key="value" :search-input="false" class="w-64" />
    </div>

    <p v-if="error" class="text-sm text-red-600">
      {{ t('audit.error', { msg: error }) }}
    </p>
    <p v-else-if="!loading && !events.length" class="text-(--ui-text-muted)">
      {{ t('audit.empty') }}
    </p>

    <ul v-if="events.length" class="divide-y divide-(--ui-border) rounded-lg border border-(--ui-border)">
      <li v-for="e in events" :key="e.id" class="grid gap-x-4 gap-y-1 p-3 text-sm sm:grid-cols-[11rem_1fr]">
        <time class="text-(--ui-text-muted)" :datetime="e.occurred_at">{{ formatDateTime(e.occurred_at, locale) }}</time>
        <div class="space-y-1">
          <p>
            <span class="font-medium text-(--ui-text-highlighted)">{{ te(actionKey(e.action)) ? t(actionKey(e.action)) : e.action }}</span>
            <template v-if="modelOf(e.model_id)">
              ·
              <ULink v-if="modelOf(e.model_id)!.to" :to="modelOf(e.model_id)!.to" class="underline">{{ modelOf(e.model_id)!.name }}</ULink>
              <span v-else>{{ modelOf(e.model_id)!.name }}</span>
            </template>
            <UBadge v-if="e.outcome !== 'success'" :color="e.outcome === 'denied' ? 'warning' : 'error'" variant="subtle" size="sm" class="ml-2">
              {{ t(`audit.outcome.${e.outcome}`) }}
            </UBadge>
          </p>
          <p class="text-(--ui-text-muted)">
            {{ actorOf(e.actor_sub) }}
            <template v-for="s in [auditSummary(e)]" :key="s.kind">
              <template v-if="s.kind === 'status'">
                · {{ t(`registry.status.${s.from}`) }} → {{ t(`registry.status.${s.to}`) }}<template v-if="s.skipped">
                  ({{ t('audit.runSkipped') }})
                </template><template v-if="s.note">
                  · „{{ s.note }}“
                </template>
              </template>
              <template v-else-if="s.kind === 'fields'">
                · {{ s.fields.map(fieldLabel).join(', ') }}
              </template>
              <template v-else-if="s.kind === 'role'">
                · {{ s.role }}<template v-if="s.note">
                  · „{{ s.note }}“
                </template>
              </template>
              <template v-else-if="s.kind === 'job'">
                · <ULink :to="`/jobs/${s.jobId}`" class="underline">{{ t('audit.run', { id: s.jobId.slice(0, 8) }) }}</ULink>
              </template>
            </template>
          </p>
        </div>
      </li>
    </ul>

    <UButton v-if="cursor" variant="outline" color="neutral" :loading="loading" @click="load(true)">
      {{ t('audit.more') }}
    </UButton>
  </section>
</template>
