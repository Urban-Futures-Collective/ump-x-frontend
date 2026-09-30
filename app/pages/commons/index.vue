<script setup lang="ts">
// Commons: the model catalog ("Landing Screen" design). Each model is a tile; a
// click leads to execution (/run?process=<id>). Role filtering happens
// server-side in UMP, so the frontend does not need the roles for this.
const { t } = useI18n()
const { loggedIn } = useOidcAuth()
const { data: processes, pending, error, refresh } = useUmpProcesses()

// Tiles ("Landing Screen") or list ("Models list"). Stored in a cookie rather
// than localStorage so the server already renders the chosen view and nothing
// jumps on load.
const view = useCookie<'tile' | 'row'>('ump-x-commons-ansicht', {
  default: () => 'tile',
  maxAge: 60 * 60 * 24 * 365,
  sameSite: 'lax',
})

// Same three steps as on the landing page.
const steps = ['choose', 'configure', 'take'] as const
</script>

<template>
  <div class="space-y-16">
    <section class="space-y-8">
      <div class="space-y-2">
        <div class="flex flex-wrap items-center justify-between gap-4">
          <h1 class="text-2xl font-semibold text-ufc-slate-900">
            {{ t('commons.title') }}
          </h1>
          <div class="flex items-center gap-2">
            <UButton
              icon="i-lucide-layout-grid"
              :color="view === 'tile' ? 'primary' : 'neutral'"
              variant="ghost"
              size="sm"
              :aria-label="t('commons.view.tiles')"
              :aria-pressed="view === 'tile'"
              @click="() => { view = 'tile' }"
            />
            <UButton
              icon="i-lucide-list"
              :color="view === 'row' ? 'primary' : 'neutral'"
              variant="ghost"
              size="sm"
              :aria-label="t('commons.view.list')"
              :aria-pressed="view === 'row'"
              @click="() => { view = 'row' }"
            />
            <UButton
              icon="i-lucide-refresh-cw"
              color="neutral"
              variant="ghost"
              size="sm"
              :loading="pending"
              @click="refresh()"
            >
              {{ t('processes.refresh') }}
            </UButton>
          </div>
        </div>
        <p v-if="!loggedIn" class="text-[0.9375rem] text-(--ui-text-muted)">
          {{ t('commons.anonymousHint') }}
        </p>
      </div>

      <!-- User-owned Commons do not exist yet, neither in the backend nor as
           storage. The button follows the same rule as the planned sidebar
           items: visible to show where it is heading, disabled so nobody clicks
           into nothing. -->
      <div class="flex items-center gap-4">
        <UIcon name="i-lucide-folder-pen" class="size-9 text-ufc-blue-500" />
        <UButton icon="i-lucide-plus" class="rounded-full" disabled>
          {{ t('commons.new') }}
        </UButton>
      </div>

      <div class="space-y-4">
        <p class="text-[0.9375rem] text-(--ui-text)">
          {{ t('commons.lead') }}
        </p>

        <p v-if="error" class="text-sm text-red-600">
          {{ t('processes.error', { msg: apiErrorMessage(error) }) }}
        </p>

        <ul
          v-if="processes?.length"
          :class="view === 'row' ? 'max-w-3xl space-y-3' : 'grid gap-6 sm:grid-cols-2 xl:grid-cols-4'"
        >
          <li v-for="p in processes" :key="p.id">
            <ModelCard
              :title="p.title"
              :description="p.description"
              :process-id="p.id"
              :layout="view"
              :to="{ path: '/run', query: { process: p.id } }"
            />
          </li>
        </ul>
        <p v-else-if="!pending && !error" class="text-sm text-(--ui-text-muted)">
          {{ t('processes.empty') }}
        </p>
      </div>
    </section>

    <section class="space-y-4">
      <h2 class="text-2xl font-semibold text-ufc-slate-900">
        {{ t('commons.scenarios') }}
      </h2>
      <ol class="grid gap-6 md:grid-cols-3">
        <li
          v-for="(step, i) in steps"
          :key="step"
          class="space-y-2.5 py-4 md:pr-6"
        >
          <span class="inline-block bg-ufc-teal-700 pl-1 pr-4 text-lg/7 font-semibold text-white">
            {{ i + 1 }}
          </span>
          <h3 class="font-medium text-(--ui-text)">
            {{ t(`start.steps.${step}.title`) }}
          </h3>
          <p class="text-sm text-(--ui-text-muted)">
            {{ t(`start.steps.${step}.body`) }}
          </p>
        </li>
      </ol>
    </section>
  </div>
</template>
