<script setup lang="ts">
// Nur noch Hülle. Die eigentliche Erscheinung steckt in den Layouts:
// `default` ist die Arbeitsumgebung mit Seitenleiste, `auth` der Anmeldebildschirm
// mit dem Farbverlauf über die ganze Fläche.
</script>

<template>
  <UApp>
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
