<script setup lang="ts">
// Shell only. The look lives in the layouts: `default` is the workspace with
// sidebar, `auth` the sign-in screen with a full-screen gradient.

// Language and tab title for every page: screen readers pick the pronunciation from
// `lang`, and a tab without a title shows only the URL. Pages and the layout set the
// title, the template adds the product name; without a title the tab says "UMP-X".
const { locale } = useI18n()
useHead({
  htmlAttrs: { lang: locale },
  titleTemplate: title => (title ? `${title} · UMP-X` : 'UMP-X'),
})
</script>

<template>
  <UApp>
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
