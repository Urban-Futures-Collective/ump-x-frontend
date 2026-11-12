<script setup lang="ts">
import type { SourceCollection } from '~/utils/sourceCollection'

// "Load status quo" for an input the model server can prefill from its own data
// (metadata role source-collection). Reads the collection straight from the model
// server; the collections are public and send CORS headers.
const props = defineProps<{
  source: SourceCollection
  values: Record<string, string>
  /** Title of each input, to name the ones that still need a value. */
  titles: Record<string, string>
}>()
const value = defineModel<string>({ required: true })

const { t } = useI18n()

const target = computed(() => sourceUrl(props.source, props.values))
const missing = computed(() => 'missing' in target.value
  ? target.value.missing.map(n => props.titles[n] ?? n).join(', ')
  : '')

const loading = ref(false)
const loaded = ref<number | null>(null)
const failed = ref<string | null>(null)
// A loaded value no longer matches once someone edits the field by hand.
watch(value, () => { if (!loading.value) loaded.value = null })

async function load() {
  if (!('url' in target.value)) return
  loading.value = true
  failed.value = null
  try {
    const fc = await $fetch<{ type?: string, features?: unknown[] }>(target.value.url)
    if (fc?.type !== 'FeatureCollection' || !Array.isArray(fc.features)) throw new Error(t('run.source.notCollection'))
    value.value = JSON.stringify({ type: 'FeatureCollection', features: fc.features })
    await nextTick()
    loaded.value = fc.features.length
  }
  catch (e) {
    loaded.value = null
    failed.value = apiErrorMessage(e)
  }
  finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
    <UButton
      type="button"
      size="sm"
      color="neutral"
      variant="outline"
      icon="i-lucide-download"
      :loading="loading"
      :disabled="!!missing"
      @click="load"
    >
      {{ t('run.source.load') }}
    </UButton>
    <p v-if="missing" class="text-xs text-(--ui-text-muted)">
      {{ t('run.source.needs', { fields: missing }) }}
    </p>
    <p v-else-if="loaded !== null" class="text-xs text-(--ui-text-muted)">
      {{ t('run.source.loaded', { n: loaded }) }}
    </p>
    <p v-if="failed" class="text-xs text-red-600">
      {{ t('run.source.failed', { msg: failed }) }}
    </p>
  </div>
</template>
