<script setup lang="ts">
// One section of the model card editor (design: Contribute › Model card). Closed it is a
// row with a summary on the right; open it shows its fields.
defineProps<{ id: string, title: string, summary?: string }>()
const open = defineModel<boolean>('open', { default: false })
</script>

<template>
  <section :id="`card-${id}`" class="scroll-mt-20 border-t border-(--ui-border) first:border-t-0">
    <button
      type="button"
      class="flex w-full items-center justify-between gap-4 px-6 py-4 text-left hover:bg-(--ui-bg-elevated)/50"
      :aria-expanded="open"
      :aria-controls="`card-${id}-body`"
      @click="open = !open"
    >
      <h2 :class="open ? 'text-lg font-semibold' : 'font-medium'">
        {{ title }}
      </h2>
      <span class="flex shrink-0 items-center gap-2 text-xs text-(--ui-text-muted)">
        {{ summary }}
        <UIcon :name="open ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'" class="size-4" aria-hidden="true" />
      </span>
    </button>
    <div v-if="open" :id="`card-${id}-body`" class="space-y-5 px-6 pb-6">
      <slot />
    </div>
  </section>
</template>
