<script setup lang="ts">
// Licence on the model card: a list of common SPDX licences, or the provider's own
// licence as free text. A stored value outside the list opens on "own licence" with the
// text kept, so older cards lose nothing.
const model = defineModel<string>({ required: true })
const { t } = useI18n()

const OWN = '__own__'
const own = ref(!!model.value.trim() && !knownLicense(model.value))
const items = computed(() => [
  ...LICENSES.map(l => ({ label: `${l.label} (${l.value})`, value: l.value })),
  { label: t('registry.card.licenseOwn'), value: OWN },
])
const choice = computed({
  get: () => own.value ? OWN : knownLicense(model.value)?.value,
  set: (v: string | undefined) => {
    own.value = v === OWN
    model.value = v && v !== OWN ? v : ''
  },
})
</script>

<template>
  <div class="space-y-2">
    <USelectMenu
      v-model="choice"
      :items="items"
      value-key="value"
      :placeholder="t('registry.card.licensePick')"
      class="w-full"
    />
    <UInput v-if="own" v-model="model" :placeholder="t('registry.card.licenseOwnPlaceholder')" class="w-full" />
  </div>
</template>
