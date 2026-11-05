<script setup lang="ts">
// Marks a field as translatable and names the language being edited (EN, DE).
defineProps<{ lang: string }>()
</script>

<template>
  <span class="ml-1 rounded bg-ufc-blue-50 px-1 py-0.5 align-middle text-[0.625rem] font-medium text-ufc-blue-700 uppercase">{{ lang }}</span>
</template>
