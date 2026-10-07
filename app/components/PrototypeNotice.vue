<script setup lang="ts">
// Marks a page as a prototype: sample data, nothing is saved. Offers a reset so a
// walkthrough can start again from the same state.
const { t } = useI18n()
const { reset } = useRegistryPrototype()
</script>

<template>
  <!-- Neutral text with a warning icon: the warning colour as text colour is too pale
       to read on its light background. -->
  <UAlert
    color="neutral"
    variant="subtle"
    icon="i-lucide-flask-conical"
    :ui="{ icon: 'text-(--ui-warning)' }"
    :title="t('prototype.title')"
    :description="t('prototype.text')"
    :actions="[{ label: t('prototype.reset'), color: 'neutral', variant: 'outline', onClick: reset }]"
  />
</template>
