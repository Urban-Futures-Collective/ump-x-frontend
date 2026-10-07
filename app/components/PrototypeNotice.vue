<script setup lang="ts">
// Marks a page as a prototype: sample data, nothing is saved. Offers a reset so a
// walkthrough can start again from the same state.
const { t } = useI18n()
const { reset } = useRegistryPrototype()
</script>

<template>
  <UAlert
    color="warning"
    variant="subtle"
    icon="i-lucide-flask-conical"
    :title="t('prototype.title')"
    :description="t('prototype.text')"
    :actions="[{ label: t('prototype.reset'), color: 'warning', variant: 'outline', onClick: reset }]"
  />
</template>
