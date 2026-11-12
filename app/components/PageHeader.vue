<script setup lang="ts">
// Head of a page (design: Contribute): title and a short intro on the left, search and the
// page's main action on the right (default slot). One size for every page title.
defineProps<{ title: string, intro?: string }>()
</script>

<template>
  <div class="flex flex-wrap items-start justify-between gap-4">
    <div class="max-w-xl space-y-1">
      <h1 class="text-2xl font-semibold text-ufc-slate-900">
        {{ title }}
      </h1>
      <p v-if="intro" class="text-sm text-(--ui-text-muted)">
        {{ intro }}
      </p>
    </div>
    <div v-if="$slots.default" class="flex flex-wrap items-center gap-2">
      <slot />
    </div>
  </div>
</template>
