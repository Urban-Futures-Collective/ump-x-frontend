<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import type { ListFilter, ListOption } from '~/types/list'

// The bar above a list (design: Contribute): tabs or a count on the left, sort, filter
// and tiles/list on the right as icon buttons. Every list page uses it, so sorting and
// filtering look and work the same everywhere. Search sits in the PageHeader.
const props = defineProps<{ sortItems?: ListOption[], filters?: ListFilter[] }>()
const sort = defineModel<string>('sort')
const filter = defineModel<Record<string, string[]>>('filter', { default: () => ({}) })
// Tiles or list; the toggle shows only when the page binds it.
const tiles = defineModel<boolean | undefined>('tiles', { default: undefined })
const { t } = useI18n()

const sortMenu = computed<DropdownMenuItem[]>(() => (props.sortItems ?? []).map(o => ({
  label: o.label,
  type: 'checkbox' as const,
  checked: sort.value === o.value,
  onUpdateChecked: () => { sort.value = o.value },
})))

const filters = computed(() => (props.filters ?? []).filter(f => f.items.length))
const chosen = (key: string) => filter.value[key] ?? []
const active = computed(() => filters.value.some(f => chosen(f.key).length))

function set(key: string, values: string[]) {
  filter.value = { ...filter.value, [key]: values }
}
function pick(f: ListFilter, value: string) {
  const now = chosen(f.key)
  if (f.multiple) set(f.key, now.includes(value) ? now.filter(v => v !== value) : [...now, value])
  else set(f.key, [value])
}

// One filter: its values with "All" on top, as in Contribute. Several: one section each,
// they stay open while ticking, and a reset at the end.
const filterMenu = computed<DropdownMenuItem[][]>(() => {
  const several = filters.value.length > 1
  const groups = filters.value.map((f) => {
    const keepOpen = (e: Event) => { if (f.multiple) e.preventDefault() }
    const items: DropdownMenuItem[] = f.items.map(o => ({
      label: o.label,
      type: 'checkbox' as const,
      checked: chosen(f.key).includes(o.value),
      onSelect: keepOpen,
      onUpdateChecked: () => pick(f, o.value),
    }))
    if (!f.multiple) {
      items.unshift({
        label: f.allLabel ?? t('list.all'),
        type: 'checkbox' as const,
        checked: !chosen(f.key).length,
        onUpdateChecked: () => set(f.key, []),
      })
    }
    return several ? [{ label: f.label, type: 'label' as const }, ...items] : items
  })
  if (several) {
    groups.push([{
      label: t('list.reset'),
      icon: 'i-lucide-x',
      disabled: !active.value,
      onSelect: () => { filter.value = {} },
    }])
  }
  return groups
})
const filterLabel = computed(() => filters.value.length === 1 ? filters.value[0]!.label : t('list.filter'))
</script>

<template>
  <div class="flex flex-wrap items-end justify-between gap-2 border-b border-(--ui-border)">
    <div class="-mb-px min-w-0">
      <slot />
    </div>
    <div class="flex items-center gap-1 pb-1">
      <UDropdownMenu v-if="sortMenu.length" :items="sortMenu" :content="{ align: 'end' }">
        <UButton icon="i-lucide-arrow-down-up" color="neutral" variant="ghost" :aria-label="t('list.sort')" />
      </UDropdownMenu>
      <UDropdownMenu v-if="filters.length" :items="filterMenu" :content="{ align: 'end' }">
        <UButton
          icon="i-lucide-list-filter"
          :color="active ? 'primary' : 'neutral'"
          variant="ghost"
          :aria-label="filterLabel"
        />
      </UDropdownMenu>
      <template v-if="tiles !== undefined">
        <UButton
          icon="i-lucide-layout-grid"
          :color="tiles ? 'primary' : 'neutral'"
          variant="ghost"
          :aria-label="t('list.viewTiles')"
          :aria-pressed="tiles"
          @click="() => { tiles = true }"
        />
        <UButton
          icon="i-lucide-list"
          :color="tiles ? 'neutral' : 'primary'"
          variant="ghost"
          :aria-label="t('list.viewList')"
          :aria-pressed="!tiles"
          @click="() => { tiles = false }"
        />
      </template>
    </div>
  </div>
</template>
